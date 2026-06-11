import { ImageResponse } from "next/og";
import { sygnetDataUri } from "@/lib/brand/sygnet";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders off-DOM
      <img src={sygnetDataUri()} width={size.width} height={size.height} alt="" />
    ),
    { ...size }
  );
}
