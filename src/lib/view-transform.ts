// View transform shared by the canvas and the coord helpers. The
// canvas renders content inside a <g transform={`translate(${x} ${y})
// scale(${scale})`}>, so any pointer-to-data conversion must apply
// the inverse of this transform.
export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
}
