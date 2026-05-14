import {
  cyan,
  deepOrange,
  deepPurple,
  lightGreen,
  orange,
  pink,
} from "@mui/material/colors";

export const iconTileBackgroundByKey = {
  activities: lightGreen[500],
  join: pink[500],
  portfolio: cyan[500],
  programs: deepOrange[500],
  projects: deepPurple[500],
  template: orange[500],
} as const;

export type IconTileColorKey = keyof typeof iconTileBackgroundByKey;
