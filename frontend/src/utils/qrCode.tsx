import React, { useMemo } from 'react';

interface QRCodeSVGProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Deterministic QR Code Matrix Generator
 */
export function generateQRMatrix(value: string): boolean[][] {
  const dim = 29; // 29x29 QR version 3
  const grid: boolean[][] = Array.from({ length: dim }, () => Array(dim).fill(false));

  // 1. Draw 7x7 Finder Pattern at (r, c)
  const drawFinderPattern = (startR: number, startC: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          grid[startR + r][startC + c] = true;
        } else {
          grid[startR + r][startC + c] = false;
        }
      }
    }
    // White separator around finder patterns
    for (let i = 0; i < 8; i++) {
      if (startR + 7 < dim && startC + i < dim) grid[startR + 7][startC + i] = false;
      if (startR + i < dim && startC + 7 < dim) grid[startR + i][startC + 7] = false;
    }
  };

  drawFinderPattern(0, 0); // Top-Left
  drawFinderPattern(0, dim - 7); // Top-Right
  drawFinderPattern(dim - 7, 0); // Bottom-Left

  // 2. Alignment Pattern at (20, 20) (5x5)
  const alignR = 20;
  const alignC = 20;
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      if (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) {
        grid[alignR + r][alignC + c] = true;
      } else {
        grid[alignR + r][alignC + c] = false;
      }
    }
  }

  // 3. Timing Patterns
  for (let i = 8; i < dim - 8; i++) {
    grid[6][i] = i % 2 === 0;
    grid[i][6] = i % 2 === 0;
  }

  // 4. Deterministic Hash Data Generator based on value string
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  const pseudoRandom = () => {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    return hash / 4294967296;
  };

  // Reserved regions checker
  const isReserved = (r: number, c: number) => {
    // Finders
    if (r <= 8 && c <= 8) return true;
    if (r <= 8 && c >= dim - 8) return true;
    if (r >= dim - 8 && c <= 8) return true;
    // Alignment
    if (r >= 18 && r <= 22 && c >= 18 && c <= 22) return true;
    // Timing
    if (r === 6 || c === 6) return true;
    // Center logo cutout (11..17)
    if (r >= 11 && r <= 17 && c >= 11 && c <= 17) return true;
    return false;
  };

  for (let r = 0; r < dim; r++) {
    for (let c = 0; c < dim; c++) {
      if (!isReserved(r, c)) {
        grid[r][c] = pseudoRandom() > 0.48;
      }
    }
  }

  return grid;
}

/**
 * Deterministic SVG QR Code Generator for AMTS E-Tickets
 * Generates official-looking QR code matrix with position locators, timing patterns,
 * alignment markers, deterministic data blocks, and central AMTS shield emblem.
 */
export const QRCodeSVG: React.FC<QRCodeSVGProps> = ({ value, size = 180, className = '' }) => {
  const matrix = useMemo(() => generateQRMatrix(value), [value]);

  const dim = matrix.length;
  const cellSize = size / dim;

  return (
    <div className={`amts-qr-container ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="amts-qr-svg"
        shapeRendering="crispEdges"
      >
        <rect width={size} height={size} fill="#ffffff" rx={8} />
        {matrix.map((row, r) =>
          row.map((isDark, c) => {
            if (!isDark) return null;
            return (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize + 0.1}
                height={cellSize + 0.1}
                fill="#111827"
              />
            );
          })
        )}
        {/* Center AMTS Logo Badge Overlay */}
        <circle cx={size / 2} cy={size / 2} r={cellSize * 3.4} fill="#ffffff" stroke="#D32F2F" strokeWidth={2.5} />
        <text
          x={size / 2}
          y={size / 2 + 3.5}
          textAnchor="middle"
          fontSize={10}
          fontWeight="bold"
          fill="#D32F2F"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          AMTS
        </text>
      </svg>
    </div>
  );
};
