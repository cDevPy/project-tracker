document.addEventListener("DOMContentLoaded", () => {
  const input = document.querySelector("input[type='email']");

  input.addEventListener("focus", () => {
    input.parentElement.classList.add("focused");
  });

  input.addEventListener("blur", () => {
    input.parentElement.classList.remove("focused");
  });
});
