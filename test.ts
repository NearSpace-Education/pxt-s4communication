let id = 1
S4comms.init(id, 1000)
basic.showIcon(IconNames.Heart)
basic.forever(function () {
    basic.showString("...")
    S4comms.downlink(1, 3, 4, 2)
    basic.pause(100)
})
