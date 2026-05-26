import { useApp } from '../context/AppContext';
import DimensionPanel from './DimensionPanel';
import Center360 from './Center360';
import { Dimension, ContentItem } from '../types';

export default function Layout360() {
  const { appData, focusedItemId, getRelatedItems } = useApp();

  const sortedDims = [...appData.dimensions].sort((a, b) => a.slot - b.slot).filter(d => d.visible);
  const leftDims = sortedDims.filter(d => d.slot >= 0 && d.slot <= 3);
  const rightDims = sortedDims.filter(d => d.slot >= 4 && d.slot <= 7);

  const relatedMap: Map<string, ContentItem[]> = focusedItemId
    ? getRelatedItems(focusedItemId)
    : new Map();

  const getItemsForDim = (dim: Dimension): ContentItem[] =>
    relatedMap.get(dim.id) ?? [];

  return (
    <div className="flex flex-1 gap-2 p-2 min-h-0 overflow-hidden">
      {/* Left Column */}
      <div className="flex flex-col gap-2 w-64 flex-shrink-0">
        {leftDims.map(dim => (
          <DimensionPanel
            key={dim.id}
            dimension={dim}
            relatedItems={getItemsForDim(dim)}
          />
        ))}
      </div>

      {/* Center Column — detail view */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <Center360 />
      </div>

      {/* Right Column */}
      <div className="flex flex-col gap-2 w-64 flex-shrink-0">
        {rightDims.map(dim => (
          <DimensionPanel
            key={dim.id}
            dimension={dim}
            relatedItems={getItemsForDim(dim)}
          />
        ))}
      </div>
    </div>
  );
}
