import InputAdornment from "@mui/material/InputAdornment";
import type { SxProps, Theme } from "@mui/material/styles";
import type { TextFieldProps } from "@mui/material/TextField";
import TextField from "@mui/material/TextField";
import { useTranslation } from "react-i18next";
import { SearchIcon } from "../../assets/icons/SearchIcon";

type SearchFieldProps = Readonly<Omit<TextFieldProps, "variant">>;

const searchFieldSx: SxProps<Theme> = {
  "& .MuiOutlinedInput-root": {
    height: 22,
    borderRadius: 999,
    padding: (theme) => theme.spacing(1, 2, 1, 1),
    backgroundColor: "transparent",
  },
  "& .MuiOutlinedInput-input": {
    padding: 0,
    fontSize: (theme) => theme.typography.pxToRem(14),
  },
};

export function SearchField({
  "aria-label": ariaLabel,
  className,
  placeholder,
  size = "small",
  slotProps,
  sx,
  ...props
}: SearchFieldProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("common.search");
  const mergedSx: SxProps<Theme> = Array.isArray(sx)
    ? [searchFieldSx, ...sx]
    : [searchFieldSx, sx];

  return (
    <TextField
      className={className}
      aria-label={ariaLabel ?? resolvedPlaceholder}
      placeholder={resolvedPlaceholder}
      size={size}
      sx={mergedSx}
      slotProps={{
        ...slotProps,
        input: {
          ...slotProps?.input,
          endAdornment: (
            <InputAdornment position="end">
              <SearchIcon />
            </InputAdornment>
          ),
        },
      }}
      variant="outlined"
      {...props}
    />
  );
}
