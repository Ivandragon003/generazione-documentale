import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";

const port = Number.parseInt(process.env.PDF_SERVICE_PORT ?? "3100", 10);
const workdir = process.env.PDF_SERVICE_WORKDIR ?? "/tmp/pdf-service";
const pandocPath = process.env.PANDOC_PATH ?? "/usr/bin/pandoc";
const timeoutMs = Number.parseInt(
  process.env.PDF_GENERATION_TIMEOUT_MS ?? "120000",
  10,
);

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Payload troppo grande"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function metadata(options, title, author) {
  return [
    "--from",
    "markdown+smart+pipe_tables",
    "--to",
    "pdf",
    "--pdf-engine",
    options.engine ?? "xelatex",
    `--metadata=title:${title}`,
    `--metadata=author:${author}`,
    "--metadata=lang:it",
    "-V",
    `papersize=${options.paper ?? "a4"}`,
    "-V",
    `fontsize=${options.fontSize ?? "11pt"}`,
    "-V",
    `geometry:top=${options.marginTop ?? "2.5cm"},bottom=${options.marginBottom ?? "2.5cm"},left=${options.marginLeft ?? "2.5cm"},right=${options.marginRight ?? "2.5cm"}`,
    "-V",
    `mainfont=${options.mainFont ?? "Liberation Serif"}`,
    "-V",
    `sansfont=${options.sansFont ?? "Liberation Sans"}`,
    "-V",
    `monofont=${options.monoFont ?? "Liberation Mono"}`,
    "-V",
    `colorlinks=${options.colorLinks ?? "true"}`,
    "-V",
    `linkcolor=${options.linkColor ?? "blue"}`,
  ];
}

function runPandoc(markdown, outputPath, options, title, author) {
  return new Promise((resolve, reject) => {
    const process = spawn(
      pandocPath,
      [...metadata(options, title, author), "--output", outputPath],
      { stdio: ["pipe", "ignore", "pipe"] },
    );
    let stderr = "";
    const timer = setTimeout(() => {
      process.kill("SIGKILL");
      reject(new Error(`Pandoc timeout dopo ${timeoutMs}ms`));
    }, timeoutMs);

    process.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    process.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    process.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Pandoc exit ${code}: ${stderr.slice(0, 500)}`));
    });
    process.stdin.end(markdown, "utf8");
  });
}

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.method !== "POST" || request.url !== "/generate") {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  const filename = `${randomUUID()}.pdf`;
  const outputPath = join(workdir, filename);
  try {
    const payload = JSON.parse(await readBody(request));
    if (!payload.markdown || typeof payload.markdown !== "string") {
      throw new Error("markdown mancante");
    }
    await mkdir(workdir, { recursive: true });
    await runPandoc(
      payload.markdown,
      outputPath,
      payload.options ?? {},
      payload.title ?? "Documento",
      payload.author ?? "MAC Documents",
    );

    response.writeHead(200, { "Content-Type": "application/pdf" });
    createReadStream(outputPath).pipe(response);
    response.on("finish", () => {
      void rm(outputPath, { force: true });
    });
  } catch (error) {
    await rm(outputPath, { force: true }).catch(() => undefined);
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
});

server.listen(port, () => {
  console.log(`pdf-service listening on ${port}`);
});
