export class Command {
  constructor(label, execute, undo) {
    this.label = label;
    this.execute = execute;
    this.undo = undo;
  }
}

export class HistoryManager {
  constructor(eventBus, limit = 200) {
    this.eventBus = eventBus;
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
  }

  execute(command, options = { alreadyExecuted: false }) {
    if (!options.alreadyExecuted) {
      command.execute();
    }
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.#emit();
  }

  undo() {
    const command = this.undoStack.pop();
    if (!command) {
      return;
    }
    command.undo();
    this.redoStack.push(command);
    this.#emit();
  }

  redo() {
    const command = this.redoStack.pop();
    if (!command) {
      return;
    }
    command.execute();
    this.undoStack.push(command);
    this.#emit();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  timeline() {
    return this.undoStack.map((entry, index) => ({
      step: index + 1,
      label: entry.label,
    }));
  }

  #emit() {
    this.eventBus.emit("history:changed", {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      timeline: this.timeline(),
    });
  }
}
