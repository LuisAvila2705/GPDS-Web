//Muesta y oculta las preguntas precuentes
document.addEventListener("DOMContentLoaded", function () {
  const preguntas = document.querySelectorAll(".faq-question");

  preguntas.forEach((pregunta) => {
    pregunta.addEventListener("click", () => {
      const item = pregunta.parentElement;
      item.classList.toggle("open");
    });
  });
});

//Muestra los % del circulo
document.addEventListener("DOMContentLoaded", () => {
  const percentageEl = document.querySelector("#percentage span");
  const textEl = document.getElementById("statsText");
  const statCircle = document.querySelector(".stat-circle");

  const dataMap = {
    doctor: {
      percentage: 1,
      text: "Desarrollar una plataforma digital que permita a ciudadanos, organizaciones y administradores registrar, monitorear y visualizar en tiempo real las acciones comunitarias (ambientales, sociales, educativas y económicas), con el fin de fomentar la participación ciudadana, la transparencia y el desarrollo sostenible."
    },
    center: {
      percentage: 2,
      text: "Facilitar a las comunidades y organizaciones una herramienta sencilla y confiable para documentar sus acciones, compartir evidencias y medir su impacto colectivo, impulsando la colaboración, la responsabilidad social y la mejora continua en beneficio del entorno."
    },
    specialty: {
      percentage: 3,
      text: "Convertirse en la plataforma líder en el ámbito hispanoamericano para gestionar y visibilizar el impacto social y ambiental de las comunidades, integrando tecnología, datos y participación ciudadana para alcanzar ciudades y comunidades más sostenibles y transparentes en los próximos años."
    }
  };

  let currentAnimation;

  function animatePercentage(target) {
    let count = 0;
    clearInterval(currentAnimation);

    currentAnimation = setInterval(() => {
      if (count <= target) {
        percentageEl.textContent = count + "";
        count++;
      } else {
        clearInterval(currentAnimation);
      }
    }, 20);
  }

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("data-type");
      const { percentage, text } = dataMap[type];

      statCircle.classList.remove("pop");
      textEl.classList.remove("fade");

      // Reinicia animaciones
      void statCircle.offsetWidth;
      void textEl.offsetWidth;

      animatePercentage(percentage);
      textEl.textContent = text;

      // Reaplica animaciones
      statCircle.classList.add("pop");
      textEl.classList.add("fade");
    });
  });

  // Inicia con doctor
  animatePercentage(dataMap.doctor.percentage);
});