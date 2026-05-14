import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";
import type { ReactNode } from "react";
import {
  type IconTileColorKey,
  iconTileBackgroundByKey,
} from "./iconTileColors";

type IconTileProps = {
  readonly children: ReactNode;
  readonly colorKey: IconTileColorKey;
};

const iconTileSx = (colorKey: IconTileColorKey): SxProps<Theme> => ({
  width: 18,
  height: 18,
  borderRadius: "4px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "common.white",
  backgroundColor: iconTileBackgroundByKey[colorKey],
  "& .MuiSvgIcon-root": {
    fontSize: 12,
    flexShrink: 0,
  },
});

export function IconTile({ children, colorKey }: IconTileProps) {
  return <Box sx={iconTileSx(colorKey)}>{children}</Box>;
}
