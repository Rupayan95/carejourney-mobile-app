import { colors } from '../theme';

export interface AlertTypeMeta { value: string; label: string; color: string; tint: string }

const PURPLE = '#7C4DBF';
const PURPLE_TINT = '#EEE6F7';
const ORANGE = '#D9711E';
const ORANGE_TINT = '#FBEAD6';

/** Predefined patient safety alert types — labels + colors match the web app. */
export const ALERT_TYPES: AlertTypeMeta[] = [
  { value: 'risk_violent_behavior', label: 'Risk of Violent Behavior', color: colors.danger, tint: colors.dangerTint },
  { value: 'inappropriate_sexual_behavior', label: 'Inappropriate Sexual Behavior', color: ORANGE, tint: ORANGE_TINT },
  { value: 'carrying_weapon', label: 'Carrying Weapon on Premises', color: colors.danger, tint: colors.dangerTint },
  { value: 'hypoglycemia', label: 'Hypoglycemia', color: colors.warning, tint: colors.warningTint },
  { value: 'contact_precautions', label: 'Contact Precautions Required', color: colors.info, tint: colors.infoTint },
  { value: 'dnr', label: 'DNR (Do Not Resuscitate)', color: PURPLE, tint: PURPLE_TINT },
  { value: 'bleeding_disorder', label: 'Bleeding Disorder', color: colors.danger, tint: colors.dangerTint },
  { value: 'others', label: 'Others', color: colors.inkFaint, tint: colors.borderSoft },
];

export function alertMeta(type?: string): AlertTypeMeta {
  return ALERT_TYPES.find((t) => t.value === type) ?? { value: type ?? 'others', label: type ?? 'Alert', color: colors.inkFaint, tint: colors.borderSoft };
}
