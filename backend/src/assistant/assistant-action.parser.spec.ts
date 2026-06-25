import { AssistantActionParser } from './assistant-action.parser';

describe('AssistantActionParser', () => {
  let parser: AssistantActionParser;

  beforeEach(() => {
    parser = new AssistantActionParser();
  });

  it('returns null when no ACTION_JSON block exists', () => {
    expect(parser.parse('Plain assistant answer.')).toBeNull();
  });

  it('parses a valid create_task proposal', () => {
    const result = parser.parse(
      'I can create this.\nACTION_JSON: {"type":"create_task","projectId":"project-1","title":"Write launch notes","priority":"HIGH"}',
    );

    expect(result).toEqual({
      type: 'create_task',
      projectId: 'project-1',
      title: 'Write launch notes',
      priority: 'HIGH',
    });
  });

  it('parses a valid post_comment proposal', () => {
    const result = parser.parse(
      'Draft ready.\nACTION_JSON: {"type":"post_comment","taskId":"task-1","body":"Status update posted."}',
    );

    expect(result).toEqual({
      type: 'post_comment',
      taskId: 'task-1',
      body: 'Status update posted.',
    });
  });

  it('returns null for unsupported actions', () => {
    const result = parser.parse(
      'ACTION_JSON: {"type":"move_task","taskId":"task-1","columnId":"done"}',
    );

    expect(result).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parser.parse('ACTION_JSON: {"type":"create_task"')).toBeNull();
  });
});
