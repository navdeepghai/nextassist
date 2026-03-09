$(document).on("app_ready", function () {
	// Make NextAssist workspace sidebar item navigate to the SPA
	$(document).on(
		"click",
		'.desk-sidebar .sidebar-item-container[item-name="NextAssist"]',
		function (e) {
			e.preventDefault();
			e.stopPropagation();
			window.location.href = "/nextassist";
		}
	);
});
