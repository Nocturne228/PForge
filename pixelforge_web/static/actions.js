// =====================================================
// Shared Action State
// =====================================================

function setButtonsDisabled(disabled) {
    PF.isRunning = disabled;
    document.querySelectorAll(".btn-primary, .btn-danger").forEach((btn) => {
        btn.disabled = disabled;
    });
}
