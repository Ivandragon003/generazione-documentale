import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";

export function UserIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} fill="none" fontSize="inherit" viewBox="0 0 12 12">
      <path
        d="M10.7667 11C10.4416 4.87522 0.825123 4.87522 0.500011 11M7.68668 2.46875C7.68668 2.99089 7.47035 3.49165 7.08527 3.86087C6.7002 4.23008 6.17792 4.4375 5.63334 4.4375C5.08877 4.4375 4.56649 4.23008 4.18142 3.86087C3.79634 3.49165 3.58001 2.99089 3.58001 2.46875C3.58001 1.94661 3.79634 1.44585 4.18142 1.07663C4.56649 0.707421 5.08877 0.5 5.63334 0.5C6.17792 0.5 6.7002 0.707421 7.08527 1.07663C7.47035 1.44585 7.68668 1.94661 7.68668 2.46875Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </SvgIcon>
  );
}
