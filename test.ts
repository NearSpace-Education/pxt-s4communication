s4comm.initialize(1)
gy63.init(gy63.Address.Addr0x77)
s4comm.onMasterPoll(function () {
    s4comm.sendAtmosphere(gy63.pressure(), gy63.temperature())
})
