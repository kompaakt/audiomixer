const getWaveformData = (audioBuffer: AudioBuffer, dataPoints: number) => {
  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = audioBuffer.getChannelData(1);

  const values = new Float32Array(dataPoints);
  const dataWindow = Math.round(leftChannel.length / dataPoints);
  for (let i = 0, y = 0, buffer = []; i < leftChannel.length; i++) {
    const summedValue =
      (Math.abs(leftChannel[i]) + Math.abs(rightChannel[i])) / 2;
    buffer.push(summedValue);
    if (buffer.length === dataWindow) {
      values[y++] = avg(buffer);
      buffer = [];
    }
  }
  return values;
};

const RMS = (values: number[]) =>
  Math.sqrt(
    values.reduce((sum, value) => sum + Math.pow(value, 2), 0) / values.length
  );
const avg = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
const max = (values: number[]) =>
  values.reduce((max, value) => Math.max(max, value), 0);

const getSVGPath = (
  waveformData: Float32Array,
  height: number,
  smoothing: number
) => {
  const maxValue = max([...waveformData]);

  let path = `M 0 ${height} `;
  for (let i = 0; i < waveformData.length; i++) {
    path += `L ${i * smoothing} ${(1 - waveformData[i] / maxValue) * height} `;
  }
  path += `V ${height} H 0 Z`;

  return path;
};

export { getWaveformData, getSVGPath };
