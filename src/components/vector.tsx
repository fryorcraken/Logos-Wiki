import type { ReactNode } from "react";

export type Item = {
  id: string;
  text: string;
  href: string;
  className?: string;
  title?: string;
  accessKey?: string;
  rel?: string;
  icon?: string;
  linkClass?: string;
};

export const Icon = ({ name }: { name: string }) => (
  <span className={`vector-icon mw-ui-icon-${name} mw-ui-icon-wikimedia-${name}`} />
);

export function MenuItem({ item }: { item: Item }) {
  return (
    <li id={item.id} className={`${item.className ?? ""} mw-list-item`.trim()}>
      <a href={item.href} title={item.title} accessKey={item.accessKey} rel={item.rel} className={item.linkClass}>
        {item.icon && <Icon name={item.icon} />}
        {item.icon && " "}
        <span>{item.text}</span>
      </a>
    </li>
  );
}

type PortletProps = { id: string; items: Item[]; heading?: string; className?: string; title?: string };

export function Portlet({ id, items, heading, className = "", title }: PortletProps) {
  const classes = ["vector-menu", "mw-portlet", `mw-portlet-${id.replace(/^p-/, "")}`, className, items.length ? "" : "emptyPortlet"];
  return (
    <div id={id} className={classes.filter(Boolean).join(" ")} title={title}>
      {heading && <div className="vector-menu-heading">{heading}</div>}
      <div className="vector-menu-content">
        <ul className="vector-menu-content-list">
          {items.map((item) => (
            <MenuItem key={item.id} item={item} />
          ))}
        </ul>
      </div>
    </div>
  );
}

type DropdownProps = {
  id: string;
  label: string;
  className?: string;
  icon?: string;
  title?: string;
  ariaLabel?: string;
  children: ReactNode;
};

export function Dropdown({ id, label, className = "", icon, title, ariaLabel, children }: DropdownProps) {
  const button = "vector-dropdown-label cdx-button cdx-button--fake-button cdx-button--fake-button--enabled cdx-button--weight-quiet";
  return (
    <div id={id} className={`vector-dropdown ${className}`.trim()} title={title}>
      <input type="checkbox" id={`${id}-checkbox`} role="button" aria-haspopup="true" className="vector-dropdown-checkbox" aria-label={ariaLabel ?? label} />
      <label id={`${id}-label`} htmlFor={`${id}-checkbox`} className={icon ? `${button} cdx-button--icon-only` : button} aria-hidden="true">
        {icon && <Icon name={icon} />}
        <span className="vector-dropdown-label-text">{label}</span>
      </label>
      <div className="vector-dropdown-content">{children}</div>
    </div>
  );
}

export function PinnableHeader({ name, label, pinned, heading }: { name: string; label: string; pinned: boolean; heading?: boolean }) {
  const Label = heading ? "h2" : "div";
  return (
    <div
      className={`vector-pinnable-header vector-${name}-pinnable-header vector-pinnable-header-${pinned ? "pinned" : "unpinned"}`}
      data-feature-name={`${name}-pinned`}
      data-pinnable-element-id={`vector-${name}`}
    >
      <Label className="vector-pinnable-header-label">{label}</Label>
      <button className="vector-pinnable-header-toggle-button vector-pinnable-header-pin-button">move to sidebar</button>
      <button className="vector-pinnable-header-toggle-button vector-pinnable-header-unpin-button">hide</button>
    </div>
  );
}
