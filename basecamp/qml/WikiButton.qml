import QtQuick 2.15
import QtQuick.Controls 2.15

Button {
    id: btn
    property bool primary: false
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
            if (!btn.enabled) return btn.primary ? "#a0b3d6" : "#f8f9fa"
            if (btn.primary) return btn.down ? "#2a4b8d" : (btn.hovered ? "#447ff5" : "#3366cc")
            return btn.down ? "#c8ccd1" : (btn.hovered ? "#ffffff" : "#f8f9fa")
        }
        border.width: 1
        border.color: {
            if (!btn.enabled) return "#c8ccd1"
            if (btn.primary) return btn.down ? "#2a4b8d" : (btn.hovered ? "#447ff5" : "#3366cc")
            return btn.hovered ? "#72777d" : "#a2a9b1"
        }
    }

    contentItem: Text {
        text: btn.text
        font.pixelSize: 13
        font.weight: Font.DemiBold
        color: btn.primary ? "#ffffff" : (btn.enabled ? "#202122" : "#72777d")
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        elide: Text.ElideRight
    }
}
