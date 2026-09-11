import React from 'react';
import { CheckCircle2, Circle, ShieldAlert, ShieldCheck, Sparkles, Lock } from 'lucide-react';

export interface PasswordCriteria {
  hasMinLength: boolean;
  hasLowercase: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

export type PasswordStrengthLevel = 'insegura' | 'segura' | 'excelente';

export interface PasswordStrengthResult {
  score: number;
  percentage: number;
  level: PasswordStrengthLevel;
  levelLabel: string;
  criteria: PasswordCriteria;
  isValid: boolean;
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const pwd = password || '';
  const criteria: PasswordCriteria = {
    hasMinLength: pwd.length >= 8,
    hasLowercase: /[a-z]/.test(pwd),
    hasUppercase: /[A-Z]/.test(pwd),
    hasNumber: /[0-9]/.test(pwd),
    hasSymbol: /[^A-Za-z0-9]/.test(pwd),
  };

  let score = 0;
  if (criteria.hasMinLength) score += 1;
  if (criteria.hasLowercase) score += 1;
  if (criteria.hasUppercase) score += 1;
  if (criteria.hasNumber) score += 1;
  if (criteria.hasSymbol) score += 1;

  let percentage = 0;
  if (pwd.length > 0) {
    // Gradual percentage calculation so user sees immediate filling as they type
    percentage = Math.min(100, Math.round((score / 5) * 100));
    // If length is less than 8, cap at 40%
    if (pwd.length < 8 && percentage > 40) {
      percentage = 40;
    }
  }

  let level: PasswordStrengthLevel = 'insegura';
  let levelLabel = 'Contraseña Insegura';

  if (score >= 5 && criteria.hasMinLength) {
    level = 'excelente';
    levelLabel = 'Contraseña Excelente';
  } else if (score >= 3 && criteria.hasMinLength) {
    level = 'segura';
    levelLabel = 'Contraseña Segura';
  } else {
    level = 'insegura';
    levelLabel = 'Contraseña Insegura';
  }

  // To be valid for initial setup, requires minimum 8 characters, plus a combination of letters (upper & lower), numbers and symbols
  const isValid = criteria.hasMinLength && score >= 4;

  return {
    score,
    percentage,
    level,
    levelLabel,
    criteria,
    isValid,
  };
}

interface PasswordStrengthMeterProps {
  password: string;
  showCriteriaBadges?: boolean;
  showLegend?: boolean;
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
  showCriteriaBadges = true,
  showLegend = true,
}) => {
  const result = evaluatePasswordStrength(password);
  const { criteria, percentage, level, levelLabel } = result;

  const isBlank = !password || password.length === 0;

  // Level visual styles
  const getBarGradient = () => {
    if (isBlank) return 'bg-slate-700 w-0';
    if (level === 'excelente') return 'bg-gradient-to-r from-emerald-500 to-teal-400';
    if (level === 'segura') return 'bg-gradient-to-r from-amber-500 to-yellow-400';
    return 'bg-gradient-to-r from-rose-500 to-red-500';
  };

  const getLevelColorText = () => {
    if (isBlank) return 'text-slate-400';
    if (level === 'excelente') return 'text-emerald-400';
    if (level === 'segura') return 'text-amber-400';
    return 'text-rose-400';
  };

  const getLevelBadgeBg = () => {
    if (isBlank) return 'bg-slate-800/60 border-slate-700 text-slate-400';
    if (level === 'excelente') return 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
    if (level === 'segura') return 'bg-amber-500/15 border-amber-500/40 text-amber-300';
    return 'bg-rose-500/15 border-rose-500/40 text-rose-300';
  };

  return (
    <div className="space-y-3.5 pt-1">
      {/* Level Header with Percentage & Dynamic Status */}
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-400 flex items-center gap-1.5">
          <Lock size={13} className="text-slate-400" />
          <span>Nivel de Seguridad:</span>
        </span>
        <div className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 ${getLevelBadgeBg()}`}>
          {!isBlank && level === 'excelente' && <Sparkles size={13} className="text-emerald-400 animate-pulse" />}
          {!isBlank && level === 'segura' && <ShieldCheck size={13} className="text-amber-400" />}
          {!isBlank && level === 'insegura' && <ShieldAlert size={13} className="text-rose-400" />}
          {isBlank ? 'Sin ingresar' : levelLabel}
          {!isBlank && <span className="text-[10px] opacity-80 font-mono">({percentage}%)</span>}
        </div>
      </div>

      {/* Dynamic Animated Progress Bar */}
      <div className="relative">
        <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800/80 shadow-inner">
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out ${getBarGradient()}`}
            style={{ width: isBlank ? '0%' : `${percentage}%` }}
          />
        </div>
      </div>

      {/* 3-Option Status Legend */}
      {showLegend && (
        <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
          <div
            className={`py-1 px-1.5 rounded-md border transition-all duration-200 flex items-center justify-center gap-1 ${
              !isBlank && level === 'insegura'
                ? 'bg-rose-500/20 border-rose-500/60 text-rose-300 shadow-xs ring-1 ring-rose-500/40'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-500'
            }`}
          >
            <span>●</span> Insegura
          </div>
          <div
            className={`py-1 px-1.5 rounded-md border transition-all duration-200 flex items-center justify-center gap-1 ${
              !isBlank && level === 'segura'
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-xs ring-1 ring-amber-500/40'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-500'
            }`}
          >
            <span>●</span> Segura
          </div>
          <div
            className={`py-1 px-1.5 rounded-md border transition-all duration-200 flex items-center justify-center gap-1 ${
              !isBlank && level === 'excelente'
                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-xs ring-1 ring-emerald-500/40'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-500'
            }`}
          >
            <span>●</span> Excelente
          </div>
        </div>
      )}

      {/* Interactive Criteria Chips / Badges that dynamically switch color */}
      {showCriteriaBadges && (
        <div className="space-y-2 pt-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Requisitos de Seguridad Requeridos:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {/* Criterion: 8+ Characters */}
            <div
              className={`p-2 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 transition-all duration-200 ${
                criteria.hasMinLength
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-xs'
                  : 'bg-slate-950/70 border-slate-800 text-slate-400'
              }`}
            >
              {criteria.hasMinLength ? (
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              ) : (
                <Circle size={13} className="text-slate-500 shrink-0" />
              )}
              <span className="truncate">8+ caracteres</span>
            </div>

            {/* Criterion: Lowercase a-z */}
            <div
              className={`p-2 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 transition-all duration-200 ${
                criteria.hasLowercase
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-xs'
                  : 'bg-slate-950/70 border-slate-800 text-slate-400'
              }`}
            >
              {criteria.hasLowercase ? (
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              ) : (
                <Circle size={13} className="text-slate-500 shrink-0" />
              )}
              <span className="truncate font-mono">a-z (minúscula)</span>
            </div>

            {/* Criterion: Uppercase A-Z */}
            <div
              className={`p-2 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 transition-all duration-200 ${
                criteria.hasUppercase
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-xs'
                  : 'bg-slate-950/70 border-slate-800 text-slate-400'
              }`}
            >
              {criteria.hasUppercase ? (
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              ) : (
                <Circle size={13} className="text-slate-500 shrink-0" />
              )}
              <span className="truncate font-mono">A-Z (mayúscula)</span>
            </div>

            {/* Criterion: Numbers 0-9 */}
            <div
              className={`p-2 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 transition-all duration-200 ${
                criteria.hasNumber
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-xs'
                  : 'bg-slate-950/70 border-slate-800 text-slate-400'
              }`}
            >
              {criteria.hasNumber ? (
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              ) : (
                <Circle size={13} className="text-slate-500 shrink-0" />
              )}
              <span className="truncate font-mono">0-9 (número)</span>
            </div>

            {/* Criterion: Symbols @ . _ # $ */}
            <div
              className={`p-2 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 transition-all duration-200 col-span-2 sm:col-span-2 ${
                criteria.hasSymbol
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-xs'
                  : 'bg-slate-950/70 border-slate-800 text-slate-400'
              }`}
            >
              {criteria.hasSymbol ? (
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              ) : (
                <Circle size={13} className="text-slate-500 shrink-0" />
              )}
              <span className="truncate font-mono">Símbolos (@ . _ # $ ! %)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
