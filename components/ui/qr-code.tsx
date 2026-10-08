import { useMemo } from "react";
import qrcode from "qrcode-generator";

type QrCodeProps = {
  value: string;
  size?: number;
  label?: string;
};

export function QrCode({ value, size = 200, label }: QrCodeProps) {
  const svg = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(value);
    qr.make();
    return qr.createSvgTag({ cellSize: 1, margin: 0, scalable: true });
  }, [value]);

  return (
    // White background and quiet zone stay fixed so scanners work in dark mode too.
    <div
      role="img"
      aria-label={label}
      className="rounded-2xl bg-white p-3 [&>svg]:h-full [&>svg]:w-full"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
