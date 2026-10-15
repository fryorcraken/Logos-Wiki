import { NAMESPACES } from "@/lib/title.ts";
import { esc } from "./html.ts";

let counter = 0;
const nextId = () => `ooui-php-${++counter}`;
const ICONS = `<span class='oo-ui-iconElement-icon oo-ui-iconElement-noIcon'></span><span class='oo-ui-indicatorElement-indicator oo-ui-indicatorElement-noIndicator'></span>`;

function layout(label: string, inputId: string, field: string, cls: string) {
  return `<div class='${cls} oo-ui-layout oo-ui-labelElement oo-ui-fieldLayout oo-ui-fieldLayout-align-top'><div class='oo-ui-fieldLayout-body'><span class='oo-ui-fieldLayout-header'><label for='${inputId}' class='oo-ui-labelElement-label'>${label}</label></span><div class='oo-ui-fieldLayout-field'>${field}</div></div></div>`;
}

export function textField(label: string, name: string, value = "", widgetId = name) {
  const id = nextId();
  const input = `<div id='${widgetId}' class='oo-ui-widget oo-ui-widget-enabled oo-ui-inputWidget oo-ui-textInputWidget oo-ui-textInputWidget-type-text oo-ui-textInputWidget-php'><input type='text' tabindex='0' name='${name}' value='${esc(value)}' id='${id}' class='oo-ui-inputWidget-input' />${ICONS}</div>`;
  return layout(label, id, input, "mw-htmlform-field-HTMLTextField");
}

export function namespaceField(label: string, value: string, all: string | null = null) {
  const id = nextId();
  const entries = Object.entries(NAMESPACES).filter(([n]) => Number(n) >= 0);
  const options = [
    ...(all !== null ? [`<option value='${all}'${value === all ? " selected='selected'" : ""}>all</option>`] : []),
    ...entries.map(([n, name]) => `<option value='${n}'${value === n ? " selected='selected'" : ""}>${n === "0" ? "(Main)" : esc(name)}</option>`),
  ].join("");
  const select = `<div id='namespace' class='oo-ui-widget oo-ui-widget-enabled oo-ui-inputWidget oo-ui-dropdownInputWidget oo-ui-dropdownInputWidget-php mw-widget-namespaceInputWidget'><select tabindex='0' name='namespace' id='${id}' class='oo-ui-inputWidget-input oo-ui-indicator-down'>${options}</select></div>`;
  return layout(label, id, select, "mw-htmlform-field-HTMLSelectNamespace mw-htmlform-autoinfuse");
}

export function checkField(label: string, name: string, checked: boolean) {
  const id = nextId();
  return `<div class='mw-htmlform-field-HTMLCheckField oo-ui-layout oo-ui-labelElement oo-ui-fieldLayout oo-ui-fieldLayout-align-inline'><div class='oo-ui-fieldLayout-body'><span class='oo-ui-fieldLayout-field'><span class='oo-ui-widget oo-ui-widget-enabled oo-ui-inputWidget oo-ui-checkboxInputWidget'><input type='checkbox' tabindex='0' name='${name}' value='1'${checked ? " checked='checked'" : ""} id='${id}' class='oo-ui-inputWidget-input' /><span class='oo-ui-checkboxInputWidget-checkIcon oo-ui-widget oo-ui-widget-enabled oo-ui-iconElement-icon oo-ui-icon-check oo-ui-iconElement oo-ui-labelElement-invisible oo-ui-iconWidget oo-ui-image-invert'></span></span></span><span class='oo-ui-fieldLayout-header'><label for='${id}' class='oo-ui-labelElement-label'>${label}</label></span></div></div>`;
}

export function submitButton(label: string) {
  return `<div class="mw-htmlform-submit-buttons">\n<span class='mw-htmlform-submit oo-ui-widget oo-ui-widget-enabled oo-ui-inputWidget oo-ui-buttonElement oo-ui-buttonElement-framed oo-ui-labelElement oo-ui-flaggedElement-primary oo-ui-flaggedElement-progressive oo-ui-buttonInputWidget'><button type='submit' tabindex='0' value='${label}' class='oo-ui-inputWidget-input oo-ui-buttonElement-button'><span class='oo-ui-iconElement-icon oo-ui-iconElement-noIcon oo-ui-image-invert'></span><span class='oo-ui-labelElement-label'>${label}</span><span class='oo-ui-indicatorElement-indicator oo-ui-indicatorElement-noIndicator oo-ui-image-invert'></span></button></span></div>`;
}

export function form(action: string, legend: string, fields: string[], hidden: Record<string, string> = {}) {
  const inputs = Object.entries(hidden).map(([k, v]) => `<input type="hidden" value="${esc(v)}" name="${k}">`).join("");
  return `<div class='mw-htmlform-ooui-wrapper oo-ui-layout oo-ui-panelLayout oo-ui-panelLayout-padded oo-ui-panelLayout-framed'><form action='${esc(action)}' method='get' enctype='application/x-www-form-urlencoded' class='mw-htmlform mw-htmlform-ooui oo-ui-layout oo-ui-formLayout'><fieldset class='oo-ui-layout oo-ui-labelElement oo-ui-fieldsetLayout'><legend class='oo-ui-fieldsetLayout-header'><span class='oo-ui-iconElement-icon oo-ui-iconElement-noIcon'></span><span class='oo-ui-labelElement-label'>${legend}</span></legend><div class='oo-ui-fieldsetLayout-group'><div class='oo-ui-widget oo-ui-widget-enabled'>${inputs}${fields.join("")}</div></div></fieldset></form></div>`;
}
