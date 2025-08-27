export const Color = {
  darkGray:'#bdc3c7',
  orange:'#f44336',
  light:'#FFF',
  blue:'#0040ff',
  primary:'#2c3e50',
  gray:'#ecf0f1',
}as const;
export type ColorTypes = keyof typeof Color;
