import { faker } from "@faker-js/faker";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Key = string | number;

function validateProps({
  estimateItemHeight,
  itemHeight,
}: UseFixedSizeListProps) {
  if (!itemHeight && !estimateItemHeight) {
    throw new Error(
      "You must pass either itemHeight or estimateItemHeight props"
    );
  }
}

const items = Array.from({ length: 10000 }, (_, index) => ({
  id: Math.random().toString(36).slice(2),
  text: faker.lorem.text(),
}));

interface UseFixedSizeListProps {
  itemsCount: number;
  itemHeight?: (index: number) => number;
  estimateItemHeight?: (index: number) => number;
  getItemKey: (index: number) => Key;
  overscan?: number;
  scrollingDelay?: number;
  getScrollElement: () => HTMLElement | null;
}

const DEFAULT_OVERSCAN = 3;
const DEFAULT_SCROLLING_DELAY = 100;

const containerHeight = 600;

function useFixedSizeList(props: UseFixedSizeListProps) {
  validateProps(props);

  const {
    itemHeight,
    itemsCount,
    getScrollElement,
    estimateItemHeight,
    getItemKey,
    overscan = DEFAULT_OVERSCAN,
    scrollingDelay = DEFAULT_SCROLLING_DELAY,
  } = props;

  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const [listHeight, setListHeight] = useState(0);
  const [measurementCache, setMeasurementCache] = useState<Record<Key, number>>(
    {}
  );

  useLayoutEffect(() => {
    const scrollElement = getScrollElement();

    if (!scrollElement) return;

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;

      const height =
        entry.borderBoxSize[0].blockSize ??
        entry.target.getBoundingClientRect().height;

      setListHeight(height);
    });

    resizeObserver.observe(scrollElement);

    return () => resizeObserver.disconnect();
  }, [getScrollElement]);

  useLayoutEffect(() => {
    const scrollElement = getScrollElement();
    if (!scrollElement) return;

    const handleScroll = () => {
      const scrollTop = scrollElement.scrollTop;
      setScrollTop(scrollTop);
    };

    handleScroll();

    scrollElement.addEventListener("scroll", handleScroll);
    return () => scrollElement.removeEventListener("scroll", handleScroll);
  }, [getScrollElement]);

  useEffect(() => {
    const scrollElement = getScrollElement();
    if (!scrollElement) return;

    let timeoutId: number | null = null;

    const handleScroll = () => {
      setIsScrolling(true);

      if (typeof timeoutId === "number") {
        clearTimeout(timeoutId);
      }

      // @ts-ignore
      timeoutId = setTimeout(() => {
        setIsScrolling(false);
      }, scrollingDelay);
    };

    scrollElement.addEventListener("scroll", handleScroll);
    return () => {
      scrollElement.removeEventListener("scroll", handleScroll);
      if (typeof timeoutId === "number") {
        clearTimeout(timeoutId);
      }
    };
  }, [getScrollElement, scrollingDelay]);

  const { virtualItems, startIndex, endIndex, allItems, totalHeight } =
    useMemo(() => {
      const getItemHeight = (index: number) => {
        if (itemHeight) return itemHeight(index);

        const key = getItemKey(index);
        if (typeof measurementCache[key] === "number") {
          return measurementCache[key];
        }
        return estimateItemHeight!(index);
      };

      const rangeStart = scrollTop;
      const rangeEnd = scrollTop + listHeight;

      let startIndex = -1;
      let endIndex = -1;
      let totalHeight = 0;
      const allItems = Array(itemsCount);

      for (let i = 0; i < itemsCount; i++) {
        const key = getItemKey(i);

        const row = {
          key,
          index: i,
          height: getItemHeight(i),
          offsetTop: totalHeight,
        };

        totalHeight += row.height;
        allItems[i] = row;

        if (startIndex === -1 && row.offsetTop + row.height > rangeStart) {
          startIndex = Math.max(0, i - overscan);
        }
        if (endIndex === -1 && row.offsetTop + row.height >= rangeEnd) {
          endIndex = Math.min(itemsCount - 1, i + overscan);
        }
      }

      const virtualItems = allItems.slice(startIndex, endIndex + 1);

      return { virtualItems, startIndex, endIndex, allItems, totalHeight };
    }, [
      scrollTop,
      listHeight,
      itemsCount,
      itemHeight,
      getItemKey,
      measurementCache,
      estimateItemHeight,
      overscan,
    ]);

  const measureElement = useCallback(
    (element: Element | null) => {
      if (!element) return;

      const indexAttribute = element?.getAttribute("data-index") || "";
      const index = parseInt(indexAttribute, 10);
      if (Number.isNaN(index)) {
        console.error(
          "dynamic element must have a valid 'data-index' attribute"
        );
        return;
      }

      const size = element?.getBoundingClientRect();
      const key = getItemKey(index);
      setMeasurementCache((cache) => ({ ...cache, [key]: size.height }));
    },
    [getItemKey]
  );

  return {
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
    isScrolling,
    allItems,
    measureElement,
  };
}

export const Simple = () => {
  const [listItems, setListItems] = useState(items);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const { totalHeight, virtualItems, measureElement } = useFixedSizeList({
    //   itemHeight: () => 40 + Math.round(10 * Math.random()),
    estimateItemHeight: useCallback(() => 40, []),
    itemsCount: listItems.length,
    getScrollElement: useCallback(() => scrollElementRef.current, []),
    getItemKey: useCallback((index) => listItems[index].id, [listItems]),
  });

  return (
    <div style={{ padding: "0 12px" }}>
      <h1>List</h1>
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setListItems((items) => items.slice().reverse())}
        >
          reverse
        </button>
      </div>
      <div
        ref={scrollElementRef}
        style={{
          height: containerHeight,
          overflow: "auto",
          border: "1px solid lightgrey",
          position: "relative",
        }}
      >
        <div style={{ height: totalHeight }}>
          {virtualItems.map((virtualItem) => {
            const item = listItems[virtualItem.index];
            return (
              <div
                data-index={virtualItem.index}
                ref={measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  transform: `translateY(${virtualItem.offsetTop}px)`,
                  padding: "6px 12px",
                }}
                key={item.id}
              >
                {item.text}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
