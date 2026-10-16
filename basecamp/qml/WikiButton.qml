import QtQuick 2.15
import QtQuick.Controls 2.15

Button {
    id: btn
    property bool primary: false
    implicitHeight: 32
    leftPadding: 12
    rightPadding: 12
    font.pixelSize: 13
    hoverEnabled: true

    background: Rectangle {
        radius: 2
        color: {
            if (!btn.enabled) return btn.primary ? "#c8ccd1" : "#f8f9fa"
            if (btn.primary) return btn.down ? "#2a4b8d" : (btn.hovered ? "#4b77d6" : "#3366cc")
            return btn.down ? "#c8ccd1" : (btn.hovered ? "#eaecf0" : "#ffffff")
        }
        border.width: btn.primary ? 0 : 1
        border.color: btn.enabled ? "#a2a9b1" : "#c8ccd1"
    }

    contentItem: Text {
        text: btn.text
        font.pixelSize: 13
        color: btn.primary ? "#ffffff" : (btn.enabled ? "#202122" : "#72777d")
        horizontalAlignment: Text.AlignHCenter
        verticalAlignment: Text.AlignVCenter
        elide: Text.ElideRight
    }
}
