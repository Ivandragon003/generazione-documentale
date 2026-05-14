import type { IconButtonProps } from "@mui/material/IconButton";
import MuiIconButton from "@mui/material/IconButton";
import type { SxProps, Theme } from "@mui/material/styles";

type AppIconButtonProps = IconButtonProps;

const appIconButtonSx: SxProps<Theme> = {
  width: 20,
  height: 20,
  padding: 0,
  borderRadius: "4px",
  border: "1px solid",
  borderColor: "grey.400",
  backgroundColor: "transparent",
  "& svg": {
    width: 14,
    height: 14,
    display: "block",
  },
};

export function AppIconButton({
  className,
  children,
  sx,
  ...props
}: AppIconButtonProps) {
  const mergedSx: SxProps<Theme> = Array.isArray(sx)
    ? [appIconButtonSx, ...sx]
    : [appIconButtonSx, sx];

  return (
    <MuiIconButton className={className} sx={mergedSx} {...props}>
      {children}
    </MuiIconButton>
  );
}
