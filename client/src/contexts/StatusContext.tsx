import React, { createContext, useContext, useEffect, useState } from "react";

type StatusType = "確定" | "見込み" | "予測";

interface StatusContextType {
  statusMap: Record<string, StatusType>;
  setStatusMap: React.Dispatch<React.SetStateAction<Record<string, StatusType>>>;
  updateStatus: (yearMonth: string, status: StatusType) => void;
}

const StatusContext = createContext<StatusContextType | undefined>(undefined);

interface StatusProviderProps {
  children: React.ReactNode;
}

const STORAGE_KEY = "budget-status-map";

/**
 * 2026年1月以降の年月を自動的に「予測」として設定する
 */
function initializeStatusMap(stored: Record<string, StatusType> | null): Record<string, StatusType> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  
  // 2026年1月以降の年月を生成（最大24ヶ月先まで）
  const futureMonths: Record<string, StatusType> = {};
  const startYear = 2026;
  const startMonth = 1;
  
  // 2026年1月から現在の24ヶ月後までを「予測」として設定
  let year = startYear;
  let month = startMonth;
  const endDate = new Date(currentYear, currentMonth + 24, 1);
  
  while (true) {
    const date = new Date(year, month - 1, 1);
    if (date > endDate) break;
    
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    // 既存の設定があれば優先、なければ「予測」を設定
    if (!stored || !(yearMonth in stored)) {
      futureMonths[yearMonth] = '予測';
    }
    
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  
  // 既存の設定とマージ（既存の設定を優先）
  return { ...futureMonths, ...(stored || {}) };
}

export function StatusProvider({ children }: StatusProviderProps) {
  const [statusMap, setStatusMap] = useState<Record<string, StatusType>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : null;
      return initializeStatusMap(parsed);
    } catch {
      return initializeStatusMap(null);
    }
  });

  // localStorageに保存
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(statusMap));
    }
  }, [statusMap]);

  const updateStatus = (yearMonth: string, status: StatusType) => {
    setStatusMap((prev) => ({ ...prev, [yearMonth]: status }));
  };

  return (
    <StatusContext.Provider value={{ statusMap, setStatusMap, updateStatus }}>
      {children}
    </StatusContext.Provider>
  );
}

export function useStatus() {
  const context = useContext(StatusContext);
  if (!context) {
    throw new Error("useStatus must be used within StatusProvider");
  }
  return context;
}
