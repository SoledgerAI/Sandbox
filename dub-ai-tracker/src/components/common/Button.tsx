// Reusable button component — wraps PremiumButton for backward compat
// Phase 3: Onboarding Flow → Sprint 15: PremiumButton migration

import { PremiumButton } from './PremiumButton';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
}

const VARIANT_MAP = {
  primary: 'primary',
  secondary: 'secondary',
  ghost: 'outline',
} as const;

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: ButtonProps) {
  return (
    <PremiumButton
      label={title}
      onPress={onPress}
      variant={VARIANT_MAP[variant]}
      disabled={disabled}
      loading={loading}
    />
  );
}
