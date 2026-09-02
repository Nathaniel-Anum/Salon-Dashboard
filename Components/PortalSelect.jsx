import React from "react";
import { Select } from "antd";

/**
 * Portal-styled replacement for the remaining native selects.
 * It keeps the familiar event.target.value contract so existing forms do not
 * need page-specific change handlers just to share the same dropdown UI.
 */
export default function PortalSelect({ children, onChange, value, name, className = "", ...props }) {
  const options = React.Children.toArray(children)
    .filter(React.isValidElement)
    .map((option) => ({
      label: option.props.children,
      value: String(option.props.value ?? ""),
      disabled: option.props.disabled,
    }));

  const selectedValue = value === undefined || value === null ? undefined : String(value);

  return (
    <Select
      {...props}
      className={`portal-select ${className}`.trim()}
      value={selectedValue}
      options={options}
      onChange={(nextValue) => {
        const target = { name, value: String(nextValue ?? "") };
        onChange?.({ target, currentTarget: target });
      }}
    />
  );
}
