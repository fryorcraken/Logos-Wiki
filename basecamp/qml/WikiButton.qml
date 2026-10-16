import QtQuick 2.15
import QtQuick.Controls 2.15

Button {
    id: btn
    property bool primary: false
    property bool dark: false
    implicitHeight: 32
    leftPadding: 12
    rightPadding: 12
    flat: true
    hoverEnabled: true
    font.pixelSize: 13
    font.weight: Font.DemiBold

    background: Rectangle {
        radius: 2
        color: {
            if (btn.primary) {
                if (!btn.enabled) return btn.dark ? "#3d4a66" : "#a0b3d6"
                if (btn.dark) return btn.down ? "#4b6fd4" : (btn.hovered ? "#89a2f6" : "#6d8af2")
                return btn.down ? "#2a4b8d" : (btn.hovered ? "#447ff5" : "#3366cc")
            }
            if (!btn.enabled) return btn.dark ? "#202122" : "#f8f9fa"
            if (btn.dark) return btn.down ? "#101418" : (btn.hovered ? "#27292d" : "#202122")
            return btn.down ? "#c8ccd1" : (btn.hovered ? "#ffffff" : "#f8f9fa")
        }
        border.width: 1
        border.color: {
            if (!btn.enabled) return btn.dark ? "#54595d" : "#c8ccd1"
            if (btn.primary) {
                if (btn.dark) return btn.down ? "#4b6fd4" : (btn.hovered ? "#89a2f6" : "#6d8af2")
                return btn.down ? "#2a4b8d" : (btn.hovered ? "#447ff5" : "#3366cc")
            }
            if (btn.dark) return btn.hovered ? "#a2a9b1" : "#54595d"
            return btn.hovered ? "#72777d" : "#a2a9b1"
        }
    }

    contentItem: Text {
        text: btn.text
        font.pixelSize: 13
        font.weight: Font.DemiBold
        color: btn.primary ? (btn.dark ? "#101418" : "#ffffff") : (btn.enabled ? (btn.dark ? "#eaecf0" : "#202122") : "#72777d")
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        elide: Text.ElideRight
    }
}
