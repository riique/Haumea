declare module 'react-plotly.js' {
  import { Component } from 'react';
  import { PlotParams } from 'plotly.js';

  export interface PlotProps extends Partial<PlotParams> {
    data: Partial<PlotParams['data']>;
    layout?: Partial<PlotParams['layout']>;
    config?: Partial<PlotParams['config']>;
    frames?: Partial<PlotParams['frames']>;
    style?: React.CSSProperties;
    useResizeHandler?: boolean;
    onInitialized?: (figure: Readonly<PlotParams>, graphDiv: Readonly<HTMLElement>) => void;
    onUpdate?: (figure: Readonly<PlotParams>, graphDiv: Readonly<HTMLElement>) => void;
    onPurge?: (figure: Readonly<PlotParams>, graphDiv: Readonly<HTMLElement>) => void;
    onError?: (err: Readonly<Error>) => void;
    divId?: string;
    className?: string;
    debug?: boolean;
    onAfterExport?: () => void;
    onAfterPlot?: () => void;
    onAnimated?: () => void;
    onAnimatingFrame?: (event: Readonly<unknown>) => void;
    onAnimationInterrupted?: () => void;
    onAutoSize?: () => void;
    onBeforeExport?: () => void;
    onButtonClicked?: (event: Readonly<unknown>) => void;
    onClick?: (event: Readonly<unknown>) => void;
    onClickAnnotation?: (event: Readonly<unknown>) => void;
    onDeselect?: () => void;
    onDoubleClick?: () => void;
    onFramework?: () => void;
    onHover?: (event: Readonly<unknown>) => void;
    onLegendClick?: (event: Readonly<unknown>) => boolean;
    onLegendDoubleClick?: (event: Readonly<unknown>) => boolean;
    onRelayout?: (event: Readonly<unknown>) => void;
    onRestyle?: (event: Readonly<unknown>) => void;
    onRedraw?: () => void;
    onSelected?: (event: Readonly<unknown>) => void;
    onSelecting?: (event: Readonly<unknown>) => void;
    onSliderChange?: (event: Readonly<unknown>) => void;
    onSliderEnd?: (event: Readonly<unknown>) => void;
    onSliderStart?: (event: Readonly<unknown>) => void;
    onSunburstClick?: (event: Readonly<unknown>) => void;
    onTransitioning?: () => void;
    onTransitionInterrupted?: () => void;
    onUnhover?: (event: Readonly<unknown>) => void;
    onWebGlContextLost?: () => void;
  }

  export default class Plot extends Component<PlotProps> {}
}
