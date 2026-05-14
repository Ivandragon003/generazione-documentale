import { Avatar, Badge, Box } from "@mui/material";
import OnlineDot from "./OnlineDotIcon";

/**
 *  UserAvatarIcon Component
 */
export default function UserAvatarIcon() {
  return (
    <Box
      sx={{
        top: "14px",
        left: "1232",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        badgeContent={<OnlineDot />}
        sx={{
          "& .MuiBadge-badge": {
            padding: 0,
            height: "auto",
            minWidth: "auto",

            right: "15%",
            bottom: "15%",

            border: "1.5px solid white",
            borderRadius: "50%",
          },
        }}
      >
        <Avatar sx={{ width: 28, height: 28 }} />
      </Badge>
    </Box>
  );
}
