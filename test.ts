s4comm.initialize(1)
gy63.init()
s4comm.onMasterPoll(function () {
    s4comm.sendAtmosphere(gy63.pressure(), gy63.temperature())
})
