import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DescriptionIcon from "@mui/icons-material/Description";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FolderIcon from "@mui/icons-material/Folder";
import HistoryIcon from "@mui/icons-material/History";
import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import type {
  TemplateDto,
  TemplateTreeFileNode,
  TenantDto,
} from "../../../data/api";

export type LazyTreeNode =
  | { type: "folder"; name: string; path: string }
  | { type: "template"; name: string; path: string; id: string };

type Props = {
  readonly tenants: TenantDto[];
  readonly selectedTenantUuid: string | null;
  readonly onSelectTenant: (tenantUuid: string) => void;
  readonly selectedTemplateId: string | null;
  readonly onSelectTemplate: (template: TemplateDto) => void;
  readonly onOpenVersions: (template: TemplateDto) => void;
  readonly rootNodes: LazyTreeNode[];
  readonly childrenByPath: Record<string, LazyTreeNode[]>;
  readonly loadingPaths: Record<string, boolean>;
  readonly onExpandFolder: (path: string) => void;
  readonly onSearch: (query: string) => void;
  readonly searchResults: TemplateTreeFileNode[];
};

export function ProjectStructure({
  tenants,
  selectedTenantUuid,
  onSelectTenant,
  selectedTemplateId,
  onSelectTemplate,
  onOpenVersions,
  rootNodes,
  childrenByPath,
  loadingPaths,
  onExpandFolder,
  onSearch,
  searchResults,
}: Props) {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const activeNodes = query.trim().length > 0 ? searchResults : rootNodes;

  const toggleFolder = (path: string) => {
    setOpenFolders((current) => ({
      ...current,
      [path]: !(current[path] ?? false),
    }));
    onExpandFolder(path);
  };

  const renderNode = (node: LazyTreeNode, depth: number) => {
    if (node.type === "template") {
      return (
        <Stack key={node.id} direction="row" alignItems="center">
          <ListItemButton
            selected={node.id === selectedTemplateId}
            onClick={() =>
              onSelectTemplate({
                id: node.id,
                name: node.name,
                content: "",
                fields: [],
                contentHash: "",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
            }
            sx={{ pl: 2 + depth * 2, pr: 0.5 }}
          >
            <DescriptionIcon fontSize="small" color="disabled" />
            <ListItemText primary={node.name} secondary={node.path} />
          </ListItemButton>
          <IconButton
            size="small"
            onClick={() =>
              onOpenVersions({
                id: node.id,
                name: node.name,
                content: "",
                fields: [],
                contentHash: "",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })
            }
          >
            <HistoryIcon fontSize="small" />
          </IconButton>
        </Stack>
      );
    }
    const isOpen = openFolders[node.path] ?? false;
    const children = childrenByPath[node.path] ?? [];
    return (
      <Box key={node.path}>
        <Stack
          direction="row"
          alignItems="center"
          sx={{ pl: 1 + depth * 2 }}
          className="folder-row"
        >
          <ListItemButton
            onClick={() => toggleFolder(node.path)}
            sx={{ py: 0.25, borderRadius: 1, pr: 1 }}
          >
            <Box
              component="span"
              className="folder-row-toggle"
              sx={{ display: "inline-flex", alignItems: "center" }}
            >
              {isOpen ? (
                <ExpandMoreIcon fontSize="small" />
              ) : (
                <ChevronRightIcon fontSize="small" />
              )}
            </Box>
            <FolderIcon
              fontSize="small"
              color="warning"
              className="folder-row-icon"
            />
            <Typography
              variant="subtitle2"
              noWrap
              sx={{ ml: 1 }}
              className="folder-row-label"
            >
              {node.name}
            </Typography>
          </ListItemButton>
          {loadingPaths[node.path] && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              ...
            </Typography>
          )}
        </Stack>
        {isOpen && (
          <Box>{children.map((child) => renderNode(child, depth + 1))}</Box>
        )}
      </Box>
    );
  };

  return (
    <Paper className="project-structure">
      <Box className="structure-header">
        <Typography className="structure-title" variant="overline">
          Project structure
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ px: 2 }}>
          Available tenants and templates
        </Typography>
      </Box>
      <Box sx={{ px: 2, pb: 1 }}>
        <Select
          fullWidth
          size="small"
          value={selectedTenantUuid ?? ""}
          onChange={(event) => onSelectTenant(String(event.target.value))}
        >
          {tenants.map((tenant) => (
            <MenuItem key={tenant.uuid} value={tenant.uuid}>
              {tenant.name}
            </MenuItem>
          ))}
        </Select>
      </Box>
      <Box sx={{ px: 2, pb: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search templates..."
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            onSearch(value);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Box>
      <Divider />
      {activeNodes.length === 0 ? (
        <Box className="structure-empty-state">
          {query.trim().length > 0 ? (
            <Typography variant="body2" color="text.secondary">
              No templates found for the current search.
            </Typography>
          ) : (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                No nodes available. Expand a folder or create a template.
              </Typography>
            </Stack>
          )}
        </Box>
      ) : (
        <List dense disablePadding>
          {activeNodes.map((node) => renderNode(node as LazyTreeNode, 0))}
        </List>
      )}
    </Paper>
  );
}
