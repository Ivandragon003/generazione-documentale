import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";

const port = Number.parseInt(process.env.PDF_SERVICE_PORT ?? "3100", 10);
const workdir = process.env.PDF_SERVICE_WORKDIR ?? "/tmp/pdf-service";
const pandocPath = process.env.PANDOC_PATH ?? "/usr/bin/pandoc";
const timeoutMs = Number.parseInt(
  process.env.PDF_GENERATION_TIMEOUT_MS ?? "120000",
  10,
);
const debugEnabled = (process.env.PDF_SERVICE_DEBUG ?? "false") === "true";
const saveTexOnError = (process.env.PDF_SERVICE_SAVE_TEX_ON_ERROR ?? "false") === "true";

function logDebug(message) {
  if (debugEnabled) console.log(`[pdf-service][debug] ${message}`);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Payload too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function metadata(options, title, author, format) {
  const mainFontFallbacks = Array.isArray(options.mainFontFallbacks)
    ? options.mainFontFallbacks.filter((font) => typeof font === "string" && font.trim().length > 0)
    : [];
  const fallbackArgs = mainFontFallbacks.flatMap((font) => [
    "-V",
    `mainfontfallback=${font}`,
  ]);

  const titleArgs =
    typeof title === "string" && title.trim().length > 0
      ? [`--metadata=title:${title}`]
      : [];
  const authorArgs =
    typeof author === "string" && author.trim().length > 0
      ? [`--metadata=author:${author}`]
      : [];

  return [
    "--from",
    "markdown+smart+pipe_tables",
    "--to",
    format,
    ...(format === "pdf" ? ["--pdf-engine", options.engine ?? "xelatex"] : []),
    ...titleArgs,
    ...authorArgs,
    `--metadata=lang:${options.lang ?? "it"}`,
    `--metadata=dir:${options.dir ?? "ltr"}`,
    "-V",
    `papersize=${options.paper ?? "a4"}`,
    "-V",
    `fontsize=${options.fontSize ?? "11pt"}`,
    "-V",
    `geometry:top=${options.marginTop ?? "2.5cm"},bottom=${options.marginBottom ?? "2.5cm"},left=${options.marginLeft ?? "2.5cm"},right=${options.marginRight ?? "2.5cm"}`,
    "-V",
    `mainfont=${options.mainFont ?? "Noto Sans"}`,
    "-V",
    `sansfont=${options.sansFont ?? "Noto Sans"}`,
    "-V",
    `monofont=${options.monoFont ?? "DejaVu Sans Mono"}`,
    "-V",
    `CJKmainfont=${options.cjkMainFont ?? "Noto Sans CJK JP"}`,
    ...fallbackArgs,
    "-V",
    `colorlinks=${options.colorLinks ?? "true"}`,
    "-V",
    `linkcolor=${options.linkColor ?? "blue"}`,
  ];
}

function runPandoc(markdown, outputPath, options, title, author, format) {
  return new Promise((resolve, reject) => {
    const args = [...metadata(options, title, author, format), "--output", outputPath];
    if (debugEnabled) {
      logDebug(`pandoc command: ${pandocPath} ${args.join(" ")}`);
    }
    const process = spawn(
      pandocPath,
      args,
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    let stderr = "";
    const timer = setTimeout(() => {
      process.kill("SIGKILL");
      reject(new Error(`Pandoc timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    process.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    process.on("error", (error) => {
      clearTimeout(timer);
      if (error?.code === "ENOENT") {
        reject(
          new Error(
            `Pandoc not found at path: ${pandocPath}. Verify PANDOC_PATH and installation inside pdf-service container.`,
          ),
        );
        return;
      }
      reject(
        new Error(`Pandoc startup error (${pandocPath}): ${error.message}`),
      );
    });
    process.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else {
        logDebug(`pandoc stderr: ${stderr.slice(0, 2000)}`);
        reject(new Error(`Pandoc exit ${code}: ${stderr.slice(0, 500)}`));
      }
    });
    process.stdin.end(markdown, "utf8");
  });
}

function saveTexDebug(markdown, texPath, options, title, author) {
  return new Promise((resolve) => {
    const args = [
      ...metadata(options, title, author, "latex"),
      "--output",
      texPath,
    ];
    logDebug(`saving intermediate tex: ${pandocPath} ${args.join(" ")}`);
    const process = spawn(pandocPath, args, { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    process.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    process.on("close", (code) => {
      if (code === 0) {
        logDebug(`intermediate tex saved at ${texPath}`);
      } else {
        logDebug(`failed to save intermediate tex (exit ${code}): ${stderr.slice(0, 1000)}`);
      }
      resolve();
    });
    process.on("error", () => resolve());
    process.stdin.end(markdown, "utf8");
  });
}

function pandocVersion() {
  return new Promise((resolve) => {
    const process = spawn(pandocPath, ["--version"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    process.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    process.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    process.on("error", (error) => {
      resolve({
        ok: false,
        error:
          error?.code === "ENOENT"
            ? `Pandoc not found at path: ${pandocPath}`
            : `Pandoc startup error (${pandocPath}): ${error.message}`,
      });
    });
    process.on("close", (code) => {
      if (code === 0) {
        resolve({
          ok: true,
          version: (stdout.split(/\r?\n/)[0] ?? "").trim(),
        });
        return;
      }
      resolve({
        ok: false,
        error: `Pandoc health check failed (${pandocPath}): exit ${code} ${stderr.slice(0, 300)}`,
      });
    });
  });
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    const health = await pandocVersion();
    response.writeHead(health.ok ? 200 : 503, {
      "Content-Type": "application/json",
    });
    response.end(JSON.stringify({ ...health, pandocPath }));
    return;
  }

  if (request.method !== "POST" || request.url !== "/generate") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  let finalOutputPath = "";
  let parsedPayload = null;
  try {
    const payload = JSON.parse(await readBody(request));
    parsedPayload = payload;
    const format = payload?.format === "docx" ? "docx" : "pdf";
    const filename = `${randomUUID()}.${format}`;
    finalOutputPath = join(workdir, filename);
    if (!payload.markdown || typeof payload.markdown !== "string") {
      throw new Error("markdown is required");
    }
    await mkdir(workdir, { recursive: true });
    await runPandoc(
      payload.markdown,
      finalOutputPath,
      payload.options ?? {},
      payload.title ?? "",
      payload.author ?? "",
      format,
    );

    response.writeHead(200, {
      "Content-Type":
        format === "docx"
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : "application/pdf",
    });
    createReadStream(finalOutputPath).pipe(response);
    response.on("finish", () => {
      void rm(finalOutputPath, { force: true });
    });
  } catch (error) {
    if (saveTexOnError) {
      const fallbackTexPath = finalOutputPath
        ? finalOutputPath.replace(/\.(pdf|docx)$/i, ".debug.tex")
        : join(workdir, `${randomUUID()}.debug.tex`);
      try {
        if (typeof parsedPayload?.markdown === "string") {
          await saveTexDebug(
            parsedPayload.markdown,
            fallbackTexPath,
            parsedPayload.options ?? {},
            parsedPayload.title ?? "",
            parsedPayload.author ?? "",
          );
        }
      } catch {
        // ignore debug failures
      }
    }
    if (finalOutputPath) {
      await rm(finalOutputPath, { force: true }).catch(() => undefined);
    }
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
});

server.listen(port, async () => {
  await mkdir(workdir, { recursive: true });
  await access(workdir);
  const health = await pandocVersion();
  console.log(
    `pdf-service listening on ${port}; PANDOC_PATH=${pandocPath}; ${health.ok ? health.version : health.error}`,
  );
  if (!health.ok) {
    process.exitCode = 1;
    server.close(() => process.exit(1));
  }
});
