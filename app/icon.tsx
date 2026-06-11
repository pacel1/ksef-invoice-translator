import { ImageResponse } from "next/og";
import { sygnetDataUri } from "@/lib/brand/sygnet";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      // eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders off-DOM
      <img src={sygnetDataUri()} width={size.width} height={size.height} alt="" />
    ),
    { ...size }
  );
}
