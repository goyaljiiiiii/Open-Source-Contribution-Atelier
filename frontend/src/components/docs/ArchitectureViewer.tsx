import React, { useEffect, useRef, useState, useId } from "react";
import mermaid from "mermaid";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { ZoomIn, ZoomOut, Maximize, Download, RefreshCw, X } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "react-hot-toast";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
});

interface ArchitectureViewerProps {
  chart: string;
}

export const ArchitectureViewer: React.FC<ArchitectureViewerProps> = ({ chart }) => {
  const [svgContent, setSvgContent] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "");

  useEffect(() => {
    let isMounted = true;
    
    const renderDiagram = async () => {
      try {
        setError(null);
        const cleanChart = chart.trim();
        const { svg } = await mermaid.render(`mermaid-${id}`, cleanChart);
        if (isMounted) {
          setSvgContent(svg);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : "Failed to render diagram.";
          setError(errorMessage);
        }
      }
    };
    
    renderDiagram();
    
    return () => {
      isMounted = false;
    };
  }, [chart, id]);

  const handleExportPng = async () => {
    if (!containerRef.current) return;
    try {
      const dataUrl = await toPng(containerRef.current, { backgroundColor: "#1e1e2e" });
      const link = document.createElement("a");
      link.download = `architecture-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Exported PNG successfully");
    } catch (err) {
      toast.error("Failed to export PNG");
    }
  };

  const handleExportSvg = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `architecture-${Date.now()}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Exported SVG successfully");
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (error) {
    return (
      <div className="p-4 my-4 bg-red-50 border-4 border-red-500 rounded-xl text-red-700 font-bold shadow-card-sm">
        <p>Mermaid Syntax Error:</p>
        <pre className="text-xs mt-2 overflow-auto">{error}</pre>
      </div>
    );
  }

  const ViewerContent = () => (
    <div className={`relative flex flex-col bg-[#0d0f17] border border-gray-800 shadow-xl overflow-hidden group ${isFullscreen ? "w-full h-full rounded-none" : "w-full h-[500px] rounded-2xl my-4"}`}>
      <TransformWrapper
        initialScale={1}
        minScale={0.1}
        maxScale={5}
        centerOnInit
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            {/* Toolbar */}
            <div className="absolute top-4 right-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <div className="flex bg-[#131622] rounded-lg border border-gray-700 shadow-lg overflow-hidden">
                <button onClick={() => zoomIn()} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors" title="Zoom In">
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button onClick={() => zoomOut()} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors border-l border-gray-700" title="Zoom Out">
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button onClick={() => resetTransform()} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors border-l border-gray-700" title="Reset Zoom">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex bg-[#131622] rounded-lg border border-gray-700 shadow-lg overflow-hidden">
                <button onClick={handleExportSvg} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors" title="Export SVG">
                  <span className="text-[10px] font-bold px-1 uppercase tracking-wider">SVG</span>
                </button>
                <button onClick={handleExportPng} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors border-l border-gray-700" title="Export PNG">
                  <Download className="w-4 h-4" />
                </button>
              </div>

              <button onClick={toggleFullscreen} className="p-2 bg-[#131622] text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg border border-gray-700 shadow-lg transition-colors">
                {isFullscreen ? <X className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
              </button>
            </div>

            {/* Canvas */}
            <div className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing bg-[#0d0f17] flex items-center justify-center">
              <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                <div 
                  ref={containerRef}
                  className="flex items-center justify-center min-w-full min-h-full p-8"
                  dangerouslySetInnerHTML={{ __html: svgContent }} 
                />
              </TransformComponent>
            </div>
          </>
        )}
      </TransformWrapper>
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0d0f17]/95 backdrop-blur-sm p-4 md:p-8 flex items-center justify-center">
        <ViewerContent />
      </div>
    );
  }

  return <ViewerContent />;
};

export default ArchitectureViewer;
