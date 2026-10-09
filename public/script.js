
/* Student Project Tracker - Browser Persistence */

// 1. Find existing HTML elements
const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const message = document.querySelector('#message');

// 2. Browser storage configuration
const STORAGE_KEY = 'workshop-projects-v1';

// The collection remains a single array
const projects = [];

let editingId = null;
let storageReady = false;

// 3. Display feedback using the existing message area
function showMessage(text) {
  if (message) {
    message.textContent = text;
  }
}

// 4. Validate a stored project
function isValidProject(project) {
  return (
    project !== null &&
    typeof project === 'object' &&
    !Array.isArray(project) &&
    typeof project.id === 'string' &&
    project.id.length > 0 &&
    typeof project.name === 'string' &&
    project.name.trim().length > 0 &&
    project.name.length <= 80 &&
    typeof project.status === 'string' &&
    ['Planned', 'In Progress', 'Completed'].includes(
      project.status
    )
  );
}

// 5. Restore projects when the page opens
function loadProjects() {
  try {
    const savedText = localStorage.getItem(STORAGE_KEY);

    // No saved data yet: start with an empty array
    if (savedText === null) {
      storageReady = true;
      return;
    }

    // Convert saved JSON text back into JavaScript
    const savedProjects = JSON.parse(savedText);

    // Validate the collection and every record
    if (
      !Array.isArray(savedProjects) ||
      !savedProjects.every(isValidProject)
    ) {
      throw new Error('Invalid project data');
    }

    // Make sure stored IDs are unique
    const ids = savedProjects.map(project => project.id);

    if (new Set(ids).size !== ids.length) {
      throw new Error('Duplicate project IDs');
    }

    // Restore the existing collection
    projects.push(...savedProjects);
    storageReady = true;

  } catch (error) {
    storageReady = false;

    showMessage(
      'Saved projects could not be loaded. ' +
      'Your existing stored data has not been changed. ' +
      'Adding, editing and deleting are disabled until ' +
      'the storage problem is resolved.'
    );

    console.error('Project storage error:', error);
  }
}

// 6. Save the current collection to localStorage
function saveProjects() {
  if (!storageReady) {
    return false;
  }

  try {
    // Convert the array into JSON text
    const savedText = JSON.stringify(projects);

    localStorage.setItem(STORAGE_KEY, savedText);

    return true;

  } catch (error) {
    showMessage(
      'Changes could not be saved to browser storage. ' +
      'Please check browser storage permissions or space.'
    );

    console.error('Could not save projects:', error);

    return false;
  }
}

// 7. Reset the form to Add mode
function resetForm() {
  editingId = null;

  form.reset();
  nameInput.setCustomValidity('');

  saveButton.textContent = 'Save Project';
  cancelButton.hidden = true;
}

// 8. Begin editing a project
function editProject(id) {
  if (!storageReady) {
    return;
  }

  const project = projects.find(
    project => project.id === id
  );

  if (!project) {
    return;
  }

  editingId = id;

  nameInput.value = project.name;
  statusInput.value = project.status;
  nameInput.setCustomValidity('');

  saveButton.textContent = 'Save changes';
  cancelButton.hidden = false;

  nameInput.focus();
}

// 9. Delete a project after confirmation
function deleteProject(id) {
  if (!storageReady) {
    return;
  }

  const projectIndex = projects.findIndex(
    project => project.id === id
  );

  if (projectIndex === -1) {
    return;
  }

  const project = projects[projectIndex];

  const confirmed = window.confirm(
    `Are you sure you want to delete "${project.name}"?`
  );

  // Cancelled deletion changes nothing
  if (!confirmed) {
    return;
  }

  // Remove only the selected record
  const removedProject = projects.splice(projectIndex, 1)[0];

  // Save the changed collection
  if (!saveProjects()) {
    // Restore the record if storage failed
    projects.splice(projectIndex, 0, removedProject);
    return;
  }

  // Exit Edit mode if this project was being edited
  if (editingId === id) {
    resetForm();
  }

  renderProjects();
  showMessage('');
}

// 10. Render the complete project list
function renderProjects() {
  projectList.replaceChildren();

  if (emptyState) {
    emptyState.hidden = projects.length > 0;
  }

  projects.forEach(project => {
    const listItem = document.createElement('li');

    const projectName = document.createElement('strong');
    projectName.textContent = project.name;

    const projectStatus = document.createElement('p');
    projectStatus.textContent = 'Status: ' + project.status;

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    // Edit button
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';
    editButton.disabled = !storageReady;

    editButton.addEventListener('click', () => {
      editProject(project.id);
    });

    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';
    deleteButton.disabled = !storageReady;

    deleteButton.addEventListener('click', () => {
      deleteProject(project.id);
    });

    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    listItem.appendChild(projectName);
    listItem.appendChild(projectStatus);
    listItem.appendChild(actions);

    projectList.appendChild(listItem);
  });
}

// 11. One form submit listener for Add and Edit
form.addEventListener('submit', event => {
  event.preventDefault();

  if (!storageReady) {
    return;
  }

  const name = nameInput.value.trim();
  const status = statusInput.value;

  // Validate the project name
  if (name === '') {
    nameInput.setCustomValidity('Enter a project name.');
    nameInput.reportValidity();
    return;
  }

  if (editingId === null) {
    // ADD MODE
    const newProject = {
      id: crypto.randomUUID(),
      name: name,
      status: status
    };

    projects.push(newProject);

    if (!saveProjects()) {
      // Undo the Add if storage fails
      projects.pop();
      return;
    }

  } else {
    // EDIT MODE
    const project = projects.find(
      project => project.id === editingId
    );

    if (!project) {
      resetForm();
      renderProjects();
      return;
    }

    // Remember original values for recovery
    const oldName = project.name;
    const oldStatus = project.status;

    project.name = name;
    project.status = status;

    if (!saveProjects()) {
      // Undo the Edit if storage fails
      project.name = oldName;
      project.status = oldStatus;
      return;
    }
  }

  renderProjects();
  resetForm();
  showMessage('');
  nameInput.focus();
});

// 12. Cancel edit without changing stored data
cancelButton.addEventListener('click', () => {
  resetForm();
  nameInput.focus();
});

// 13. Clear custom validation while typing
nameInput.addEventListener('input', () => {
  nameInput.setCustomValidity('');
});

// 14. Initialize the application
resetForm();
loadProjects();
renderProjects();

// Prevent changes if stored data could not be loaded
if (!storageReady) {
  nameInput.disabled = true;
  statusInput.disabled = true;
  saveButton.disabled = true;
  cancelButton.hidden = true;
}
