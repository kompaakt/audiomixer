import * as R from "ramda";
export const C = {
  TARGET_SAMPLE_RATE: 16000,
  SLIVER_DURATION: 1 / 20,
  FFT_SIZE: 1024,
  FREQUENCY_BANDS: [0, 100, 200, 400, 800, 1600, 8000],
};

const copySliver = (
  srcBuffer: AudioBuffer,
  dstBuffer: AudioBuffer,
  sliverIndex: number
) => {
  const startOffset = Math.floor(
    srcBuffer.sampleRate * sliverIndex * C.SLIVER_DURATION
  );
  const endOffset = Math.floor(
    srcBuffer.sampleRate * (sliverIndex + 1) * C.SLIVER_DURATION
  );
  const channelIndices = R.range(0, srcBuffer.numberOfChannels);
  channelIndices.forEach((channelIndex) => {
    const srcChannelData = srcBuffer.getChannelData(channelIndex);
    const dstChannelData = dstBuffer.getChannelData(channelIndex);
    const sliverOfData = srcChannelData.subarray(startOffset, endOffset);
    dstChannelData.set(sliverOfData);
  });
};
export const TIME_DOMAIN_DATA_ONLY = Symbol("TIME_DOMAIN_DATA_ONLY");
export const FREQUENCY_DATA_ONLY = Symbol("FREQUENCY_DATA_ONLY");
export const BOTH = Symbol("BOTH");

export const getSliverTimeDomainData = async (
  inputBuffer: AudioBuffer,
  sliverIndex: number
): Promise<Uint8Array | undefined> => {
  const { timeDomainData } = await getSliverData(
    inputBuffer,
    sliverIndex,
    TIME_DOMAIN_DATA_ONLY
  );
  return timeDomainData;
};

export const getSliverFrequencyData = async (
  inputBuffer: AudioBuffer,
  sliverIndex: number
): Promise<Uint8Array | undefined> => {
  const { frequencyData } = await getSliverData(
    inputBuffer,
    sliverIndex,
    FREQUENCY_DATA_ONLY
  );
  return frequencyData;
};

export type AnalysisFlag =
  | typeof TIME_DOMAIN_DATA_ONLY
  | typeof FREQUENCY_DATA_ONLY
  | typeof BOTH;

export const getSliverData = async (
  inputBuffer: AudioBuffer,
  sliverIndex: number,
  flags: AnalysisFlag = BOTH
): Promise<{
  timeDomainData?: Uint8Array;
  frequencyData?: Uint8Array;
}> => {
  const numberOfChannels = inputBuffer.numberOfChannels;
  const length = Math.ceil(inputBuffer.sampleRate * C.SLIVER_DURATION);
  const sampleRate = inputBuffer.sampleRate;
  const audioContext = new OfflineAudioContext(
    numberOfChannels,
    length,
    sampleRate
  );
  const sliverBuffer = audioContext.createBuffer(
    numberOfChannels,
    length,
    sampleRate
  );
  copySliver(inputBuffer, sliverBuffer, sliverIndex);
  const sourceNode = audioContext.createBufferSource();
  const analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = C.FFT_SIZE;
  sourceNode.buffer = sliverBuffer;
  sourceNode.connect(audioContext.destination);
  sourceNode.connect(analyserNode);
  sourceNode.start();
  await startRenderingPromise(audioContext);

  const timeDomainData =
    flags === TIME_DOMAIN_DATA_ONLY || flags === BOTH
      ? new Uint8Array(analyserNode.frequencyBinCount)
      : undefined;
  timeDomainData && analyserNode.getByteTimeDomainData(timeDomainData);

  const frequencyData =
    flags === FREQUENCY_DATA_ONLY || flags === BOTH
      ? new Uint8Array(analyserNode.frequencyBinCount)
      : undefined;
  frequencyData && analyserNode.getByteFrequencyData(frequencyData);

  return {
    timeDomainData,
    frequencyData,
  };
};

export const startRenderingPromise = (
  offlineAudioContext: OfflineAudioContext
): Promise<AudioBuffer> =>
  new Promise((resolve) => {
    offlineAudioContext.oncomplete = (e) => resolve(e.renderedBuffer);
    offlineAudioContext.startRendering();
  });
