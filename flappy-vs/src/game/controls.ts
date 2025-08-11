export type ControlAction = 'flap' | 'shoot';

export function mapPointerButtonToAction(button: number): ControlAction {
  // 0 = primary (left click / tap) -> flap, 2 = secondary (right click) -> shoot
  return button === 2 ? 'shoot' : 'flap';
}
