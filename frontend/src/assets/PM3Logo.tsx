import { useTranslation } from "react-i18next";

export function PM3Logo() {
  const { t } = useTranslation();

  return (
    <svg
      width="58"
      height="26"
      viewBox="0 0 58 26"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={t("brand.pm3Logo")}
    >
      <rect width="58" height="26" rx="6" fill="#111827" />
      <text
        x="29"
        y="17"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="11"
        fontFamily="Inter, sans-serif"
        fontWeight="700"
      >
        PM3
      </text>
    </svg>
  );
}
