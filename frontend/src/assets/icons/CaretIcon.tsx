import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

export function CaretIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} fontSize="inherit" viewBox="0 0 10 6">
      <path
        d="M1.0941 0L4.65576 3.55389L8.21741 0L9.31151 1.0941L4.65576 5.74986L0 1.0941L1.0941 0Z"
        fill="currentColor"
      />
    </SvgIcon>
  );
}
