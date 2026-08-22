"use client";

export default function NetworkGeometry({ imageBase64 }: { imageBase64: string | null }) {
  if (!imageBase64) return null;
  const downloadPng = () => {
    const link = document.createElement("a");
    link.href = imageBase64;
    link.download = "network-geometry.png";
    link.click();
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-slate-400 text-sm">Each node is a treatment; each edge is a direct comparison. Edge thickness and the number on each edge both represent the number of studies contributing that direct comparison.</p>
        <button onClick={downloadPng} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg shadow whitespace-nowrap ml-4">Download PNG</button>
      </div>
      <div className="bg-white p-4 rounded-xl shadow-inner flex justify-center overflow-x-auto">
        <img src={imageBase64} className="max-w-none" style={{ height: '520px' }} alt="Network geometry" />
      </div>
    </div>
  );
}
