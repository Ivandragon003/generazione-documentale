import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

export function ClockIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} fontSize="inherit" viewBox="0 0 12 12">
      <path
        d="M5.8275 0C2.6075 0 0 2.61333 0 5.83333C0 9.05333 2.6075 11.6667 5.8275 11.6667C9.05333 11.6667 11.6667 9.05333 11.6667 5.83333C11.6667 2.61333 9.05333 0 5.8275 0ZM5.83333 10.5C3.255 10.5 1.16667 8.41167 1.16667 5.83333C1.16667 3.255 3.255 1.16667 5.83333 1.16667C8.41167 1.16667 10.5 3.255 10.5 5.83333C10.5 8.41167 8.41167 10.5 5.83333 10.5ZM6.125 2.91667H5.25V6.41667L8.3125 8.25417L8.75 7.53667L6.125 5.97917V2.91667Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}
