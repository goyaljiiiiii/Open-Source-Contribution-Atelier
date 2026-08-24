/**
 * Badge Share Card Generator — HTML5 Canvas 1200x630 social preview card utility.
 * Tailored for Twitter/X, LinkedIn, and Facebook share card exports.
 */

export interface BadgeShareCardOptions {
  badgeName: string;
  badgeIcon?: string;
  description?: string;
  username?: string;
  date?: string | Date;
  platformName?: string;
}

export function formatShareDate(dateInput?: string | Date): string {
  const dateObj = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(dateObj.getTime())) {
    return new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  return dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = words[0] || "";

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(`${currentLine} ${word}`).width;
    if (width < maxWidth) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export function createBadgeShareCardCanvas(
  options: BadgeShareCardOptions,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return canvas;
  }

  const {
    badgeName,
    badgeIcon = "🏅",
    description = "Awarded for outstanding contributions.",
    username = "learner",
    date,
    platformName = "Open Source Contribution Atelier",
  } = options;

  const formattedUser = `@${username.replace(/^@/, "")}`;
  const formattedDate = formatShareDate(date);

  // 1. Rich dark gradient background
  const bgGradient = ctx.createLinearGradient(0, 0, 1200, 630);
  bgGradient.addColorStop(0, "#0f172a"); // slate-900
  bgGradient.addColorStop(0.5, "#1e1b4b"); // indigo-950
  bgGradient.addColorStop(1, "#020617"); // slate-950
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, 1200, 630);

  // Decorative ambient glow circles
  const glow1 = ctx.createRadialGradient(250, 250, 0, 250, 250, 400);
  glow1.addColorStop(0, "rgba(99, 102, 241, 0.25)");
  glow1.addColorStop(1, "rgba(99, 102, 241, 0)");
  ctx.fillStyle = glow1;
  ctx.beginPath();
  ctx.arc(250, 250, 400, 0, Math.PI * 2);
  ctx.fill();

  const glow2 = ctx.createRadialGradient(950, 450, 0, 950, 450, 350);
  glow2.addColorStop(0, "rgba(16, 185, 129, 0.2)");
  glow2.addColorStop(1, "rgba(16, 185, 129, 0)");
  ctx.fillStyle = glow2;
  ctx.beginPath();
  ctx.arc(950, 450, 350, 0, Math.PI * 2);
  ctx.fill();

  // 2. Outer Card Border Container
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#334155"; // slate-700
  ctx.strokeRect(24, 24, 1152, 582);

  // Inner dotted border frame
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#475569";
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(38, 38, 1124, 554);
  ctx.setLineDash([]); // Reset dash

  // 3. Header Pill Badge
  ctx.fillStyle = "#ffe066"; // Vivid yellow pill
  ctx.fillRect(64, 64, 220, 42);
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 3;
  ctx.strokeRect(64, 64, 220, 42);

  ctx.font = "900 16px 'Arial Black', Arial, sans-serif";
  ctx.fillStyle = "#111111";
  ctx.fillText("BADGE UNLOCKED", 78, 91);

  // 4. Badge Icon Emblem Container (left side)
  const emblemX = 220;
  const emblemY = 330;
  const emblemRadius = 110;

  // Emblem Outer Glow Ring
  ctx.beginPath();
  ctx.arc(emblemX, emblemY, emblemRadius + 12, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(99, 102, 241, 0.2)";
  ctx.fill();

  // Emblem Inner Disc
  const emblemGrad = ctx.createLinearGradient(
    emblemX - emblemRadius,
    emblemY - emblemRadius,
    emblemX + emblemRadius,
    emblemY + emblemRadius,
  );
  emblemGrad.addColorStop(0, "#1e293b");
  emblemGrad.addColorStop(1, "#0f172a");
  ctx.beginPath();
  ctx.arc(emblemX, emblemY, emblemRadius, 0, Math.PI * 2);
  ctx.fillStyle = emblemGrad;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#ffe066";
  ctx.stroke();

  // Draw Badge Icon Emoji / Character centered
  ctx.font = "110px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeIcon, emblemX, emblemY + 6);

  // Reset text alignment for right content area
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // 5. Content Area (right side)
  const contentX = 390;

  // Platform Name Subtitle
  ctx.font = "800 20px 'Arial Black', Arial, sans-serif";
  ctx.fillStyle = "#a5b4fc"; // indigo-300
  ctx.fillText(platformName.toUpperCase(), contentX, 175);

  // Badge Name / Title
  ctx.font = "900 48px 'Arial Black', Arial, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(badgeName, contentX, 235);

  // User & Date Tagline
  ctx.font = "700 24px Arial, sans-serif";
  ctx.fillStyle = "#38bdf8"; // sky-400
  ctx.fillText(`Unlocked by ${formattedUser} · ${formattedDate}`, contentX, 280);

  // Divider Line
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(contentX, 310);
  ctx.lineTo(1100, 310);
  ctx.stroke();

  // Description Lines
  ctx.font = "500 22px Arial, sans-serif";
  ctx.fillStyle = "#cbd5e1"; // slate-300
  const descLines = wrapText(ctx, description, 700);
  let descY = 350;
  for (const line of descLines.slice(0, 3)) {
    ctx.fillText(line, contentX, descY);
    descY += 32;
  }

  // 6. Footer Card Branding
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(contentX, 480, 710, 60);
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 2;
  ctx.strokeRect(contentX, 480, 710, 60);

  ctx.font = "800 16px Arial, sans-serif";
  ctx.fillStyle = "#818cf8"; // indigo-400
  ctx.fillText("✨ SHARE YOUR MOMENTUM", contentX + 20, 515);

  ctx.font = "700 16px Arial, sans-serif";
  ctx.fillStyle = "#94a3b8"; // slate-400
  ctx.fillText("atelier.dev", contentX + 590, 515);

  return canvas;
}

export function getBadgeShareCardDataUrl(
  options: BadgeShareCardOptions,
): string {
  const canvas = createBadgeShareCardCanvas(options);
  return canvas.toDataURL("image/png");
}

export function downloadBadgeShareCardImage(
  options: BadgeShareCardOptions,
  filename?: string,
): void {
  const dataUrl = getBadgeShareCardDataUrl(options);
  const sanitizeName = options.badgeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const downloadName = filename || `badge-share-${sanitizeName || "achievement"}.png`;

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = downloadName;
  link.click();
}
