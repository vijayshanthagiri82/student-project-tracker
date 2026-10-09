
/* Student Project Tracker - Add and Read */

// 1. Find the existing HTML elements
const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');

// 2. Store projects temporarily in memory
const projects = [];

// 3. Display every project in the array
function renderProjects() {
  // Remove previously displayed items
  projectList.replaceChildren();

  // Show the empty message only when needed
  if (emptyState) {
    emptyState.hidden = projects.length > 0;
  }

  // Create one list item for each project
  projects.forEach(project => {
    const listItem = document.createElement('li');

    const projectName = document.createElement('strong');
    projectName.textContent = project.name;

    const projectStatus = document.createElement('p');
    projectStatus.textContent = 'Status: ' + project.status;

    listItem.appendChild(projectName);
    listItem.appendChild(projectStatus);

    projectList.appendChild(listItem);
  });
}

// 4. Handle form submission
form.addEventListener('submit', event => {
  // Keep the browser on the current page
  event.preventDefault();

  // Read the current form values
  const name = nameInput.value.trim();
  const status = statusInput.value;

  // Reject an empty or whitespace-only name
  if (name === '') {
    nameInput.setCustomValidity('Enter a project name.');
    nameInput.reportValidity();
    return;
  }

  // Create a project object with a unique ID
  const newProject = {
    id: crypto.randomUUID(),
    name: name,
    status: status
  };

  // Add the project to the collection
  projects.push(newProject);

  // Display the updated collection
  renderProjects();

  // Clear the form for the next project
  form.reset();
  nameInput.setCustomValidity('');
  nameInput.focus();
});

// Clear any custom validation when typing
nameInput.addEventListener('input', () => {
  nameInput.setCustomValidity('');
});

// 5. Display the initial empty state
renderProjects();
