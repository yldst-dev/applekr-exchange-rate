import { useState } from "react";
import { Label, ListBox, Select } from "@heroui/react";
import type { Product } from "../domain/catalog";
export function Arrow({ external = false }: { external?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d={external ? "M6 18 18 6M6 6h12v12" : "M4 12h15m-6-6 6 6-6 6"} />
    </svg>
  );
}
export function Picker({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string;
  items: { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      selectedKey={value}
      onSelectionChange={(key) => {
        if (key !== null) onChange(String(key));
      }}
      placeholder="제품을 선택하세요"
      className="picker"
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox items={items}>
          {(item) => (
            <ListBox.Item id={item.id} textValue={item.label}>
              {item.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
export function ProductImage({
  product,
  small = false,
}: {
  product: Product;
  small?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return product.image && !failed ? (
    <img
      className={small ? "product-thumb" : "product-image"}
      src={product.image}
      alt={small ? "" : product.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <div
      className={
        small ? "product-thumb image-fallback" : "product-image image-fallback"
      }
      aria-hidden="true"
    >
      {product.category}
    </div>
  );
}
