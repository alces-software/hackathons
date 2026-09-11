import { createCliRenderer, TextAttributes } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { useEffect, useState } from "react";
import { readdirSync } from "node:fs";

import { dockerUp } from "./lib/util";
import Cluster from "./lib/cluster";
import { pathToCluster } from "./lib/paths";

type ClusterInfo =
  | (Partial<ReturnType<Cluster["dumpInfo"]>> & {
    status: boolean;
  })
  | undefined;

type ActionButtonProps = {
  label: string;
  color: string;
  hoverColor?: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
};

function ActionButton({
  label,
  color,
  hoverColor = "#ffffff",
  onClick,
  disabled = false,
}: Readonly<ActionButtonProps>) {
  const [hovered, setHovered] = useState(false);

  const textColor = disabled
    ? "#555555"
    : hovered
      ? hoverColor
      : color;
  const buttonLabel = disabled
    ? `  ${label}`
    : hovered
      ? `▶ ${label}`
      : `  ${label}`;

  return (
    <box
      onMouseMove={() => {
        if (!disabled) {
          setHovered(true);
        }
      }}
      onMouseOut={() => setHovered(false)}
      onMouseUp={() => {
        if (!disabled) {
          void onClick();
        }
      }}
    >
      <text
        {...{
          fg: textColor,
          bg:
            !disabled && hovered
              ? color
              : undefined,
          attributes: TextAttributes.BOLD,
        }}
      >
        {buttonLabel}
      </text>
    </box>
  );
}

// Start cluster
function startCluster(name: string) {
  new Cluster(name).start();
}

function App() {
  const [dockerActive, setDockerActive] = useState(false);
  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [clustersLoading, setClustersLoading] = useState(true);

  // Cluster waiting for destroy confirmation
  const [clusterToDestroy, setClusterToDestroy] = useState<string | null>(
    null,
  );

  // Create popup
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [newClusterName, setNewClusterName] = useState("");
  const [nodeCount, setNodeCount] = useState("1");
  const [creating, setCreating] = useState(false);

  // Prevent multiple destroy clicks while destroying
  const [destroying, setDestroying] = useState(false);

  // Collect cluster information
  useEffect(() => {
    async function loadClusters() {
      try {
        const clusterNames = readdirSync(pathToCluster(), {
          withFileTypes: true,
        })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name);

        const info = await Promise.all(
          clusterNames.map(async (name) => {
            const cluster = new Cluster(name);

            return {
              ...cluster.dumpInfo(),
              status: await cluster.isUp(),
            };
          }),
        );

        setClusters(info);
      } finally {
        setClustersLoading(false);
      }
    }

    loadClusters();

    const interval = setInterval(loadClusters, 5_000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Check Docker status
  useEffect(() => {
    const check = async () => {
      setDockerActive(await dockerUp());
    };

    check();

    const interval = setInterval(check, 5_000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Confirm cluster destruction
  async function confirmDestroy() {
    if (!clusterToDestroy || destroying) {
      return;
    }

    try {
      setDestroying(true);

      await new Cluster(clusterToDestroy).destroy();
    } finally {
      setDestroying(false);
      setClusterToDestroy(null);
    }
  }

  // Open create popup
  function openCreatePopup() {
    setNewClusterName("");
    setNodeCount("1");
    setShowCreatePopup(true);
  }

  // Close create popup
  function closeCreatePopup() {
    if (creating) {
      return;
    }

    setNewClusterName("");
    setNodeCount("1");
    setShowCreatePopup(false);
  }

  // Create cluster
  async function confirmCreate() {
    const name = newClusterName.trim();
    const nodes = Number.parseInt(nodeCount, 10);

    if (
      !name ||
      creating ||
      !Number.isInteger(nodes) ||
      nodes < 1
    ) {
      return;
    }

    // Prevent duplicate cluster names
    const alreadyExists = clusters.some(
      (cluster) => cluster?.name === name,
    );

    if (alreadyExists) {
      return;
    }

    try {
      setCreating(true);

      // Pass the requested number of nodes to your create function.
      new Cluster(name).create(nodes);

      setNewClusterName("");
      setNodeCount("1");
      setShowCreatePopup(false);
    } finally {
      setCreating(false);
    }
  }

  const trimmedClusterName = newClusterName.trim();

  const clusterNameExists = clusters.some(
    (cluster) => cluster?.name === trimmedClusterName,
  );

  const parsedNodeCount = Number.parseInt(nodeCount, 10);

  const validNodeCount =
    nodeCount.length > 0 &&
    Number.isInteger(parsedNodeCount) &&
    parsedNodeCount >= 1;

  const canCreate =
    trimmedClusterName.length > 0 &&
    !clusterNameExists &&
    validNodeCount &&
    !creating;

  const showDestroyPopup = !!clusterToDestroy;

  return (
    <box
      {...{
        flexDirection: "column",
        flexGrow: 1,
      }}
    >
      {/* Destroy confirmation popup */}
      {showDestroyPopup ? (
        <box
          {...{
            flexGrow: 1,
            alignSelf: "center",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <box
            {...{
              width: 50,
              padding: 2,
              flexDirection: "column",
              alignItems: "center",
            }}
            border
          >
            <text
              {...{
                attributes: TextAttributes.BOLD,
                fg: "#ef4444",
              }}
            >
              Confirm Destruction
            </text>

            <text>{" "}</text>

            <text>
              Are you sure you want to destroy
            </text>

            <text
              {...{
                attributes: TextAttributes.BOLD,
                fg: "#ffffff",
              }}
            >
              {clusterToDestroy}
            </text>

            <text>{" "}</text>

            <text
              {...{
                fg: "#ef4444",
              }}
            >
              This action cannot be undone.
            </text>

            <text>{" "}</text>

            <box
              {...{
                flexDirection: "row",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <ActionButton
                label={
                  destroying
                    ? "DESTROYING..."
                    : "CONFIRM"
                }
                color="#ef4444"
                disabled={destroying}
                onClick={confirmDestroy}
              />

              {!destroying && (
                <ActionButton
                  label="CANCEL"
                  color="#888888"
                  onClick={() =>
                    setClusterToDestroy(null)
                  }
                />
              )}
            </box>
          </box>
        </box>
      ) : showCreatePopup ? (
        /* Create cluster popup */
        <box
          {...{
            flexGrow: 1,
            alignSelf: "center",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <box
            {...{
              width: 50,
              padding: 2,
              flexDirection: "column",
              alignItems: "center",
            }}
            border
          >
            <text
              {...{
                attributes: TextAttributes.BOLD,
                fg: "#22c55e",
              }}
            >
              Create Cluster
            </text>

            <text>{" "}</text>

            {/* Cluster name */}
            <text>
              Enter a name for the new cluster:
            </text>

            <text>{" "}</text>

            <box
              {...{
                width: 40,
                border: true,
              }}
            >
              <input
                value={newClusterName}
                placeholder="Cluster name"
                onInput={(value: string) => {
                  setNewClusterName(value);
                }}
              />
            </box>

            <text>{" "}</text>

            {/* Node count */}
            <text>
              Number of nodes:
            </text>

            <text>{" "}</text>

            <box
              {...{
                width: 40,
                border: true,
              }}
            >
              <input
                value={nodeCount}
                placeholder="1"
                onInput={(value: string) => {
                  // Only allow whole numbers.
                  setNodeCount(
                    value.replace(/\D/g, ""),
                  );
                }}
              />
            </box>

            <text>{" "}</text>

            {/* Validation messages */}
            {clusterNameExists && (
              <text
                {...{
                  fg: "#ef4444",
                }}
              >
                A cluster with this name already exists.
              </text>
            )}

            {!clusterNameExists &&
              trimmedClusterName.length === 0 && (
                <text
                  {...{
                    fg: "#888888",
                  }}
                >
                  Enter a cluster name to continue.
                </text>
              )}

            {!validNodeCount && (
              <text
                {...{
                  fg: "#ef4444",
                }}
              >
                Number of nodes must be at least 1.
              </text>
            )}

            <text>{" "}</text>

            {/* Create / Cancel */}
            <box
              {...{
                flexDirection: "row",
                justifyContent: "center",
                gap: 4,
              }}
            >
              <ActionButton
                label={
                  creating
                    ? "CREATING..."
                    : "CREATE"
                }
                color="#22c55e"
                disabled={!canCreate}
                onClick={confirmCreate}
              />

              {!creating && (
                <ActionButton
                  label="CANCEL"
                  color="#888888"
                  onClick={closeCreatePopup}
                />
              )}
            </box>
          </box>
        </box>
      ) : (
        /* Normal application */
        <>
          {/* Header */}
          <box
            {...{
              width: 50,
              alignSelf: "center",
            }}
            border
          >
            <text
              {...{
                attributes: TextAttributes.BOLD,
                alignSelf: "center",
              }}
            >
              TAC Visualiser
            </text>

            <box
              {...{
                flexDirection: "row",
                justifyContent: "center",
              }}
            >
              <text
                {...{
                  attributes: TextAttributes.DIM,
                }}
              >
                Docker status:{" "}
              </text>

              <text
                {...{
                  fg: dockerActive
                    ? "#22c55e"
                    : "#ef4444",
                }}
              >
                ●
              </text>

              <text>
                {dockerActive
                  ? " Running"
                  : " Stopped"}
              </text>
            </box>
          </box>

          {/* Create button */}
          <box
            {...{
              alignSelf: "center",
              marginTop: 1,
              marginBottom: 1,
            }}
          >
            <ActionButton
              label="CREATE CLUSTER"
              color="#22c55e"
              onClick={openCreatePopup}
            />
          </box>

          {/* Cluster section */}
          <box
            {...{
              padding: 1,
            }}
            border
          >
            {(() => {
              if (clustersLoading) {
                return (
                  <text
                    {...{
                      fg: "#888888",
                    }}
                  >
                    Loading clusters...
                  </text>
                );
              }

              if (clusters.length === 0) {
                return (
                  <box>
                    <text
                      {...{
                        fg: "#888888",
                      }}
                    >
                      No clusters found.
                    </text>
                  </box>
                );
              }

              return (
                <box>
                  <text
                    {...{
                      alignSelf: "center",
                      attributes:
                        TextAttributes.BOLD,
                    }}
                  >
                    Clusters
                  </text>

                  <box
                    border
                    {...{
                      flexDirection: "column",
                      padding: 1,
                    }}
                  >
                    {/* Table header */}
                    <box
                      {...{
                        flexDirection: "row",
                        marginBottom: 1,
                      }}
                    >
                      <box
                        {...{
                          minWidth: 15,
                          flexGrow: 1,
                        }}
                      >
                        <text
                          {...{
                            attributes:
                              TextAttributes.BOLD,
                          }}
                        >
                          Name
                        </text>
                      </box>

                      <box
                        {...{
                          minWidth: 15,
                          flexGrow: 1,
                        }}
                      >
                        <text
                          {...{
                            attributes:
                              TextAttributes.BOLD,
                          }}
                        >
                          Status
                        </text>
                      </box>

                      <box
                        {...{
                          minWidth: 15,
                          flexGrow: 1,
                        }}
                      >
                        <text
                          {...{
                            attributes:
                              TextAttributes.BOLD,
                          }}
                        >
                          CPUs
                        </text>
                      </box>

                      <box
                        {...{
                          minWidth: 15,
                          flexGrow: 1,
                        }}
                      >
                        <text
                          {...{
                            attributes:
                              TextAttributes.BOLD,
                          }}
                        >
                          Nodes
                        </text>
                      </box>

                      <box
                        {...{
                          minWidth: 15,
                          flexGrow: 1,
                        }}
                      >
                        <text
                          {...{
                            attributes:
                              TextAttributes.BOLD,
                          }}
                        >
                          Port
                        </text>
                      </box>

                      <box
                        {...{
                          minWidth: 15,
                          flexGrow: 1,
                        }}
                      >
                        <text
                          {...{
                            attributes:
                              TextAttributes.BOLD,
                          }}
                        >
                          Action
                        </text>
                      </box>

                      <box
                        {...{
                          minWidth: 15,
                          flexGrow: 1,
                        }}
                      >
                        <text
                          {...{
                            attributes:
                              TextAttributes.BOLD,
                          }}
                        >
                          Destroy
                        </text>
                      </box>
                    </box>

                    {/* Rows */}
                    {clusters
                      .toReversed()
                      .map((cluster) => (
                        <box
                          key={cluster?.name}
                          {...{
                            flexDirection: "row",
                            alignItems: "center",
                          }}
                        >
                          {/* Name */}
                          <box
                            {...{
                              minWidth: 15,
                              flexGrow: 1,
                            }}
                          >
                            <text>
                              {cluster?.name ??
                                "Unknown"}
                            </text>
                          </box>

                          {/* Status */}
                          <box
                            {...{
                              flexDirection: "row",
                              minWidth: 15,
                              flexGrow: 1,
                            }}
                          >
                            <text
                              {...{
                                fg: cluster?.status
                                  ? "#22c55e"
                                  : "#ef4444",
                              }}
                            >
                              ●
                            </text>

                            <text>
                              {cluster?.status
                                ? " Running"
                                : " Stopped"}
                            </text>
                          </box>

                          {/* CPUs */}
                          <box
                            {...{
                              minWidth: 15,
                              flexGrow: 1,
                            }}
                          >
                            <text>
                              {cluster?.cpus ??
                                "Unknown"}
                            </text>
                          </box>

                          {/* Nodes */}
                          <box
                            {...{
                              minWidth: 15,
                              flexGrow: 1,
                            }}
                          >
                            <text>
                              {cluster?.nodes ??
                                "Unknown"}
                            </text>
                          </box>

                          {/* Port */}
                          <box
                            {...{
                              minWidth: 15,
                              flexGrow: 1,
                            }}
                          >
                            <text>
                              {cluster?.port
                                ? `:${cluster.port}`
                                : "Unknown"}
                            </text>
                          </box>

                          {/* Start / Stop */}
                          <box
                            {...{
                              minWidth: 15,
                              flexGrow: 1,
                            }}
                          >
                            {cluster?.name &&
                              (cluster.status ? (
                                <ActionButton
                                  label="STOP"
                                  color="#f59e0b"
                                  onClick={() =>
                                    new Cluster(
                                      cluster.name!,
                                    ).stop()
                                  }
                                />
                              ) : (
                                <ActionButton
                                  label="START"
                                  color="#22c55e"
                                  onClick={() =>
                                    new Cluster(
                                      cluster.name!,
                                    ).start()
                                  }
                                />
                              ))}
                          </box>

                          {/* Destroy */}
                          <box
                            {...{
                              minWidth: 15,
                              flexGrow: 1,
                            }}
                          >
                            {cluster?.name && (
                              <ActionButton
                                label="DESTROY"
                                color="#ef4444"
                                onClick={() =>
                                  setClusterToDestroy(
                                    cluster.name!,
                                  )
                                }
                              />
                            )}
                          </box>
                        </box>
                      ))}
                  </box>
                </box>
              );
            })()}
          </box>
        </>
      )}
    </box>
  );
}

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
});

createRoot(renderer).render(<App />);
