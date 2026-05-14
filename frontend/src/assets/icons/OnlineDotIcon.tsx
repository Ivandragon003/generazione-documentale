import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

export const OnlineDot = (props: SvgIconProps) => (
  <SvgIcon
    {...props}
    fontSize="inherit"
    sx={{ display: "block", ...props.sx }}
    viewBox="0 0 8 8"
  >
    <rect width="8" height="8" rx="4" fill="#2E7D32" />
  </SvgIcon>
);

export default OnlineDot;
