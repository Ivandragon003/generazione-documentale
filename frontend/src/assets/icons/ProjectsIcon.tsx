import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

export function ProjectsIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} fontSize="inherit" viewBox="0 0 12 12">
      <path
        d="M0 12H4V10H0V12ZM0 0V2H12V0H0ZM0 7H8V5H0V7Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}
