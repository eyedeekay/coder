import GitHub from "@mui/icons-material/GitHub";
import type { WorkspaceApp } from "api/typesGenerated";
import { Button } from "components/Button/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "components/DropdownMenu/DropdownMenu";
import { Spinner } from "components/Spinner/Spinner";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "components/Tooltip/Tooltip";
import {
	ArrowLeftIcon,
	BugIcon,
	EllipsisVerticalIcon,
	ExternalLinkIcon,
	GitPullRequestArrowIcon,
} from "lucide-react";
import type { Task } from "modules/tasks/tasks";
import type { FC } from "react";
import { Link as RouterLink } from "react-router-dom";
import { cn } from "utils/cn";
import { truncateURI } from "utils/uri";
import { TaskAppIFrame } from "./TaskAppIframe";

type TaskSidebarProps = {
	task: Task;
};

type SidebarAppStatus = "error" | "loading" | "healthy";

const getSidebarApp = (task: Task): [WorkspaceApp | null, SidebarAppStatus] => {
	const sidebarAppId = task.workspace.latest_build.ai_task_sidebar_app_id;
	// a task workspace with a finished build must have a sidebar app id
	if (!sidebarAppId && task.workspace.latest_build.job.completed_at) {
		console.error(
			"Task workspace has a finished build but no sidebar app id",
			task.workspace,
		);
		return [null, "error"];
	}

	const sidebarApp = task.workspace.latest_build.resources
		.flatMap((r) => r.agents)
		.flatMap((a) => a?.apps)
		.find((a) => a?.id === sidebarAppId);

	if (!task.workspace.latest_build.job.completed_at) {
		// while the workspace build is running, we don't have a sidebar app yet
		return [null, "loading"];
	}
	if (!sidebarApp) {
		// The workspace build is complete but the expected sidebar app wasn't found in the resources.
		// This could happen due to timing issues or temporary inconsistencies in the data.
		// We return "loading" instead of "error" to avoid showing an error state if the app
		// becomes available shortly after. The tradeoff is that users may see a loading state
		// indefinitely if there's a genuine issue, but this is preferable to false error alerts.
		return [null, "loading"];
	}
	if (sidebarApp.health === "disabled") {
		return [sidebarApp, "error"];
	}
	if (sidebarApp.health === "healthy") {
		return [sidebarApp, "healthy"];
	}
	if (sidebarApp.health === "initializing") {
		return [sidebarApp, "loading"];
	}
	if (sidebarApp.health === "unhealthy") {
		return [sidebarApp, "error"];
	}

	// exhaustiveness check
	const _: never = sidebarApp.health;
	// this should never happen
	console.error(
		"Task workspace has a finished build but the sidebar app is in an unknown health state",
		task.workspace,
	);
	return [null, "error"];
};

export const TaskSidebar: FC<TaskSidebarProps> = ({ task }) => {
	const [sidebarApp, sidebarAppStatus] = getSidebarApp(task);

	return (
		<aside
			className={cn([
				[
					"flex flex-col h-full shrink-0",
					"border-0 border-r border-solid border-border",
				],
				"w-[520px]",
			])}
		>
			<header className="border-0 border-b border-solid border-border p-4 pt-0">
				<div className="flex items-center justify-between py-1">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button size="icon" variant="subtle" asChild className="-ml-2">
									<RouterLink to="/tasks">
										<ArrowLeftIcon />
										<span className="sr-only">Back to tasks</span>
									</RouterLink>
								</Button>
							</TooltipTrigger>
							<TooltipContent>Back to tasks</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					<DropdownMenu>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<DropdownMenuTrigger asChild>
										<Button size="icon" variant="subtle" className="-mr-2">
											<EllipsisVerticalIcon />
											<span className="sr-only">Settings</span>
										</Button>
									</DropdownMenuTrigger>
								</TooltipTrigger>
								<TooltipContent>Settings</TooltipContent>
							</Tooltip>
						</TooltipProvider>

						<DropdownMenuContent>
							<DropdownMenuItem asChild>
								<RouterLink
									to={`/@${task.workspace.owner_name}/${task.workspace.name}`}
								>
									View workspace
								</RouterLink>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<h1 className="m-0 mt-1 text-base font-medium truncate">
					{task.prompt || task.workspace.name}
				</h1>

				{task.workspace.latest_app_status?.uri && (
					<div className="flex items-center gap-2 mt-2 flex-wrap">
						<TaskStatusLink uri={task.workspace.latest_app_status.uri} />
					</div>
				)}
			</header>

			{sidebarAppStatus === "healthy" && sidebarApp ? (
				<TaskAppIFrame
					active
					key={sidebarApp.id}
					app={sidebarApp}
					task={task}
				/>
			) : sidebarAppStatus === "loading" ? (
				<div className="flex-1 flex flex-col items-center justify-center">
					<Spinner loading className="mb-4" />
				</div>
			) : (
				<div className="flex-1 flex flex-col items-center justify-center">
					<h3 className="m-0 font-medium text-content-primary text-base">
						Error
					</h3>
					<span className="text-content-secondary text-sm">
						<span>Failed to load the sidebar app.</span>
						{sidebarApp?.health != null && (
							<span> The app is {sidebarApp.health}.</span>
						)}
					</span>
				</div>
			)}
		</aside>
	);
};

type TaskStatusLinkProps = {
	uri: string;
};

const TaskStatusLink: FC<TaskStatusLinkProps> = ({ uri }) => {
	let icon = <ExternalLinkIcon />;
	let label = truncateURI(uri);

	if (uri.startsWith("https://github.com")) {
		const issueNumber = uri.split("/").pop();
		const [org, repo] = uri.split("/").slice(3, 5);
		const prefix = `${org}/${repo}`;

		if (uri.includes("pull/")) {
			icon = <GitPullRequestArrowIcon />;
			label = issueNumber
				? `${prefix}#${issueNumber}`
				: `${prefix} Pull Request`;
		} else if (uri.includes("issues/")) {
			icon = <BugIcon />;
			label = issueNumber ? `${prefix}#${issueNumber}` : `${prefix} Issue`;
		} else {
			icon = <GitHub />;
			label = `${org}/${repo}`;
		}
	}

	return (
		<Button asChild variant="outline" size="sm" className="min-w-0">
			<a href={uri} target="_blank" rel="noreferrer">
				{icon}
				{label}
			</a>
		</Button>
	);
};
