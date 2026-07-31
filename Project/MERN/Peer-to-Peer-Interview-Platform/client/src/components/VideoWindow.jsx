export default function VideoWindow({
  localVideoRef,
  remoteVideoRef,
  mediaError,
  connected,
  role,
}) {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Video</h2>
        <span
          className={`text-xs px-2 py-1 rounded ${
            connected ? "bg-emerald-700" : "bg-rose-700"
          }`}
        >
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      {mediaError && (
        <p className="text-sm text-amber-400 bg-amber-950/50 p-2 rounded">
          Camera/mic: {mediaError}
        </p>
      )}

      <div className="grid grid-rows-2 gap-3 flex-1 min-h-0">
        <div className="relative bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
          <span className="absolute top-2 left-2 text-xs bg-black/60 px-2 py-0.5 rounded z-10">
            You ({role})
          </span>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover min-h-[140px]"
          />
        </div>
        <div className="relative bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
          <span className="absolute top-2 left-2 text-xs bg-black/60 px-2 py-0.5 rounded z-10">
            Peer
          </span>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover min-h-[140px]"
          />
        </div>
      </div>
    </div>
  );
}
